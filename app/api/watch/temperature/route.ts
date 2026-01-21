import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { createGeneralAlertBubble, sendCriticalAlertFlexMessage } from '@/lib/line/flex-messages';
import { createNotification } from "@/lib/notifications";
import { Client } from '@line/bot-sdk';

const lineClient = new Client({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
    channelSecret: process.env.LINE_CHANNEL_SECRET || '',
});

async function handleRequest(request: Request) {
    try {
        const body = await request.json();

        const rawTemp = body.value || body.temperature_value || 0;
        const currentTemp = parseFloat(rawTemp);
        const targetId = body.uId || body.users_id || body.lineId;

        if (!targetId) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });


        if (currentTemp <= 0 || currentTemp > 50) {
            return NextResponse.json({ success: true, message: "Ignored invalid temp" });
        }


        const user = await prisma.user.findUnique({
            where: { id: parseInt(targetId) },
            include: {
                dependentProfile: {
                    include: {
                        caregiver: { include: { user: true } },
                        tempSetting: true,

                        temperatureRecords: { take: 1, orderBy: { timestamp: 'desc' } }
                    }
                }
            }
        });

        if (!user || !user.dependentProfile) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const dependent = user.dependentProfile;
        const maxTemp = dependent.tempSetting?.maxTemperature || 37.5;


        const recoveryTemp = maxTemp - 0.5;


        const isAlertSent = dependent.isTemperatureAlertSent;
        let isAbnormal = false;

        if (isAlertSent) {

            isAbnormal = currentTemp >= recoveryTemp;
        } else {

            isAbnormal = currentTemp > maxTemp;
        }

        const statusString = isAbnormal ? 'ABNORMAL' : 'NORMAL';


        let shouldSendLine = false;
        let newAlertStatus = isAlertSent;
        let messageType = 'NONE';


        const lastRecord = dependent.temperatureRecords[0];
        const now = new Date();
        let timeDiffSec = 9999;
        if (lastRecord) {
            timeDiffSec = (now.getTime() - new Date(lastRecord.timestamp).getTime()) / 1000;
        }

        if (isAbnormal) {

            if (!isAlertSent) {
                shouldSendLine = true;
                newAlertStatus = true;
                messageType = 'CRITICAL';
            }

            else if (timeDiffSec > 3600) {
                shouldSendLine = true;
                messageType = 'CRITICAL';
            }
        } else {

            if (isAlertSent) {
                shouldSendLine = true;
                newAlertStatus = false;
                messageType = 'RECOVERY';
            }
        }



        let record = null;

        // Check if there is a record from today to update
        if (lastRecord) {
            const lastRecordDate = new Date(lastRecord.timestamp);
            const today = new Date();
            const isSameDay = lastRecordDate.getDate() === today.getDate() &&
                lastRecordDate.getMonth() === today.getMonth() &&
                lastRecordDate.getFullYear() === today.getFullYear();

            if (isSameDay) {
                // Update the existing record
                record = await prisma.temperatureRecord.update({
                    where: { id: lastRecord.id },
                    data: {
                        value: currentTemp,
                        status: statusString,
                        timestamp: new Date(),
                    }
                });
            }
        }

        // If no record updated, create a new one
        if (!record) {
            record = await prisma.temperatureRecord.create({
                data: {
                    dependentId: dependent.id,
                    value: currentTemp,
                    status: statusString,
                    timestamp: new Date(),
                }
            });
        }


        if (shouldSendLine && dependent.caregiver?.user.lineId) {
            const lineId = dependent.caregiver.user.lineId;
            console.log(`️ Temp Alert: ${messageType} (${currentTemp} °C)`);

            try {
                if (messageType === 'CRITICAL') {

                    await sendCriticalAlertFlexMessage(
                        lineId,
                        record || { id: 0, timestamp: new Date() },
                        user,
                        dependent.caregiver.phone || '',
                        dependent as any,
                        'TEMP',
                        `️อุณหภูมิร่างกายสูง ${currentTemp.toFixed(1)} °C`
                    );

                    await createNotification(
                        "HELP",
                        "Temperature Alert",
                        `อุณหภูมิร่างกายสูง (${currentTemp.toFixed(1)} °C) - ${dependent.firstName} ${dependent.lastName}`,
                        `/admin/alerts`
                    );
                }
                else if (messageType === 'RECOVERY') {
                    const msg = createGeneralAlertBubble(
                        " อุณหภูมิร่างกายปกติ",
                        "อุณหภูมิลดลงอยู่ในเกณฑ์ปกติแล้ว",
                        `${currentTemp.toFixed(1)} °C`,
                        "#10B981",
                        false
                    );
                    await lineClient.pushMessage(lineId, { type: 'flex', altText: 'อุณหภูมิปกติแล้ว', contents: msg });
                }
            } catch (err) {
                console.error("LINE Send Error:", err);
            }
        }


        if (newAlertStatus !== isAlertSent) {
            await prisma.dependentProfile.update({
                where: { id: dependent.id },
                data: { isTemperatureAlertSent: newAlertStatus }
            });
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Server Error:", error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}

export async function POST(req: Request) { return handleRequest(req); }
export async function PUT(req: Request) { return handleRequest(req); }