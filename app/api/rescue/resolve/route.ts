import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { AlertStatus } from '@prisma/client';
import { Client } from '@line/bot-sdk';
import { createCaseAcceptedBubble, createCaseClosedBubble } from '@/lib/line/flex-messages';

const lineClient = new Client({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
    channelSecret: process.env.LINE_CHANNEL_SECRET || '',
});

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { action, alertId, name, phone, details } = body;

        if (!alertId || !action) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

        const id = parseInt(alertId);

        const existingAlert = await prisma.extendedHelp.findUnique({
            where: { id: id },
            include: { dependent: { include: { caregiver: { include: { user: true } } } } }
        });

        if (!existingAlert) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const rescueGroup = await prisma.rescueGroup.findFirst({ orderBy: { createdAt: 'desc' } });
        const caregiverLineId = existingAlert.dependent?.caregiver?.user?.lineId;

        if (action === 'accept') {
            if (existingAlert.status !== AlertStatus.DETECTED) {
                return NextResponse.json({
                    error: "Case already taken",
                    takenBy: existingAlert.rescuerName
                }, { status: 409 });
            }

            const updated = await prisma.extendedHelp.update({
                where: { id },
                data: {
                    status: AlertStatus.ACKNOWLEDGED,
                    rescuerName: name,
                    rescuerPhone: phone,
                    rescuerLat: null,
                    rescuerLng: null
                }
            });

            const dependentName = `${existingAlert.dependent?.firstName} ${existingAlert.dependent?.lastName}`;
            const reportTime = new Date(existingAlert.requestedAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });

            const acceptBubble = createCaseAcceptedBubble(name, phone, dependentName, reportTime);

            if (rescueGroup) {
                await lineClient.pushMessage(rescueGroup.groupId, {
                    type: 'flex', altText: `รับเคสแล้วโดย ${name}`, contents: acceptBubble
                });
            }
            if (caregiverLineId) {
                await lineClient.pushMessage(caregiverLineId, {
                    type: 'flex', altText: `เจ้าหน้าที่กำลังเดินทาง`, contents: acceptBubble
                });
            }

            return NextResponse.json({ success: true, status: 'ACKNOWLEDGED' });
        }

        if (action === 'close') {
            const updated = await prisma.extendedHelp.update({
                where: { id },
                data: {
                    status: AlertStatus.RESOLVED,
                    details: details,
                    resolvedAt: new Date()
                }
            });

            const dependentName = `${existingAlert.dependent?.firstName} ${existingAlert.dependent?.lastName}`;
            const reportTime = new Date(existingAlert.requestedAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });

            const closeBubble = createCaseClosedBubble(existingAlert.rescuerName!, details, updated.resolvedAt!, dependentName, reportTime);

            if (rescueGroup) {
                await lineClient.pushMessage(rescueGroup.groupId, {
                    type: 'flex', altText: `ปิดเคสเรียบร้อย`, contents: closeBubble
                });
            }
            if (caregiverLineId) {
                await lineClient.pushMessage(caregiverLineId, {
                    type: 'flex', altText: `ปิดเคสเรียบร้อย`, contents: closeBubble
                });
            }

            return NextResponse.json({ success: true, status: 'RESOLVED' });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });

    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}