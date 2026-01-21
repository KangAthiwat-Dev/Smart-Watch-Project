import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { sendCriticalAlertFlexMessage, createGeneralAlertBubble } from '@/lib/line/flex-messages';
import { createNotification } from "@/lib/notifications";
import { Client } from '@line/bot-sdk';

const lineClient = new Client({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
    channelSecret: process.env.LINE_CHANNEL_SECRET || '',
});

async function handleRequest(request: Request) {
    try {
        const body = await request.json();
        const targetId = body.uId || body.lineId || body.users_id;
        const bpm = parseInt(body.bpm || 0);

        if (!targetId) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });


        if (bpm <= 0 || bpm > 250) {
            return NextResponse.json({ success: true, message: "Ignored invalid bpm" });
        }


        const user = await prisma.user.findUnique({
            where: { id: parseInt(targetId) },
            include: {
                dependentProfile: {
                    include: {
                        caregiver: { include: { user: true } },
                        heartRateSetting: true,

                        heartRateRecords: { take: 1, orderBy: { timestamp: 'desc' } },
                        locations: { take: 1, orderBy: { timestamp: 'desc' } }
                    }
                }
            }
        });

        if (!user || !user.dependentProfile) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const dependent = user.dependentProfile;
        const settings = dependent.heartRateSetting;

        const minVal = settings?.minBpm || 60;
        const maxVal = settings?.maxBpm || 100;



        const buffer = 5;
        const isAlertSent = dependent.isHeartRateAlertSent;
        let isAbnormal = false;

        if (isAlertSent) {


            const isRecovered = (bpm > (minVal + buffer)) && (bpm < (maxVal - buffer));
            isAbnormal = !isRecovered;
        } else {

            isAbnormal = (bpm < minVal || bpm > maxVal);
        }

        const statusString = isAbnormal ? 'ABNORMAL' : 'NORMAL';


        let shouldSendLine = false;
        let newAlertStatus = isAlertSent;
        let messageType = 'NONE';


        const lastRecord = dependent.heartRateRecords[0];
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

            else if (timeDiffSec > 1800) {
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
                record = await prisma.heartRateRecord.update({
                    where: { id: lastRecord.id },
                    data: {
                        bpm: bpm,
                        status: statusString,
                        timestamp: new Date(),
                    }
                });
            }
        }

        // If no record updated, create a new one
        if (!record) {
            record = await prisma.heartRateRecord.create({
                data: {
                    dependentId: dependent.id,
                    bpm: bpm,
                    status: statusString,
                    timestamp: new Date(),
                },
            });
        }


        if (shouldSendLine && dependent.caregiver?.user.lineId) {
            const lineId = dependent.caregiver.user.lineId;
            console.log(` HeartRate Alert: ${messageType} (${bpm} bpm)`);

            try {
                if (messageType === 'CRITICAL') {

                    await sendCriticalAlertFlexMessage(
                        lineId,
                        record || { id: 0, timestamp: new Date() },
                        user,
                        dependent.caregiver.phone || '',
                        dependent as any,
                        'HEART',
                        `️ชีพจรผิดปกติ ${bpm} bpm`
                    );

                    await createNotification(
                        "HELP",
                        "Heart Rate Alert",
                        `ชีพจรผิดปกติ (${bpm} bpm) - ${dependent.firstName} ${dependent.lastName}`,
                        `/admin/alerts`
                    );
                }
                else if (messageType === 'RECOVERY') {
                    const msg = createGeneralAlertBubble(
                        " อัตราการเต้นหัวใจปกติ",
                        `กลับมาอยู่ในเกณฑ์ปกติแล้ว`,
                        `${bpm} bpm`,
                        "#10B981",
                        false
                    );
                    await lineClient.pushMessage(lineId, { type: 'flex', altText: 'อัตราการเต้นหัวใจปกติแล้ว', contents: msg });
                }
            } catch (err) {
                console.error("LINE Send Error:", err);
            }
        }


        if (newAlertStatus !== isAlertSent) {
            await prisma.dependentProfile.update({
                where: { id: dependent.id },
                data: { isHeartRateAlertSent: newAlertStatus }
            });
        }

        return NextResponse.json({ success: true, data: record });

    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Error' }, { status: 500 });
    }
}

export async function POST(req: Request) { return handleRequest(req); }
export async function PUT(req: Request) { return handleRequest(req); }