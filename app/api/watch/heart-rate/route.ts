import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { sendCriticalAlertFlexMessage, createGeneralAlertBubble } from '@/lib/line/flex-messages';
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

    // 🛑 กฏเหล็ก: ถ้าค่าเป็น 0 หรือน้อยกว่า (Sensor ยังไม่ทำงาน) -> จบเลย
    if (bpm <= 0) {
        return NextResponse.json({ success: true, message: "Ignored 0 bpm" });
    }

    // 1. ดึงข้อมูล User
    const user = await prisma.user.findUnique({
      where: { id: parseInt(targetId) },
      include: { 
          dependentProfile: {
              include: {
                  caregiver: { include: { user: true } },
                  heartRateSetting: true,
                  // ✅ ดึง Location ล่าสุดมาด้วย เพื่อใช้ทำ Map ใน Flex Message
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

    // 2. Logic Alert
    const isAbnormal = (bpm < minVal || bpm > maxVal);
    const isAlertSent = dependent.isHeartRateAlertSent; 

    // ⭐ ย้ายการบันทึก Record มาไว้ตรงนี้ (ก่อนส่ง LINE) ⭐
    // เพื่อให้เรามี record.id ไปแปะในปุ่ม SOS
    const record = await prisma.heartRateRecord.create({
        data: {
          dependentId: dependent.id,
          bpm: bpm,
          status: isAbnormal ? 'ABNORMAL' : 'NORMAL',
          timestamp: new Date(),
        },
    });

    let shouldSendLine = false;
    let newAlertStatus = isAlertSent;
    let messageType = 'NONE';

    if (isAbnormal) {
        if (!isAlertSent) {
            shouldSendLine = true;
            newAlertStatus = true;
            messageType = 'CRITICAL';
        }
    } else {
        if (isAlertSent) {
            shouldSendLine = true;
            newAlertStatus = false;
            messageType = 'RECOVERY';
        }
    }

    // 3. ส่ง LINE
    if (shouldSendLine && dependent.caregiver?.user.lineId) {
        const lineId = dependent.caregiver.user.lineId;
        console.log(`💓 HeartRate Alert: ${messageType} (${bpm} bpm)`);

        if (messageType === 'CRITICAL') {
            // ✅ ใช้ sendCriticalAlertFlexMessage แทน เพื่อให้ได้ปุ่ม SOS ที่สมบูรณ์
            // และส่ง type = 'HEALTH'
            await sendCriticalAlertFlexMessage(
                lineId,
                record, // ส่ง record ที่เพิ่งสร้าง (มี ID แล้ว)
                user,
                dependent.caregiver.phone || '',
                dependent as any,
                'HEART' // 👈 พระเอกของเรา: ระบุว่าเป็น HEALTH
            );
        } 
        else if (messageType === 'RECOVERY') {
            // ส่วน Recovery ใช้แบบเดิมได้ เพราะไม่ต้องมีปุ่ม SOS
            const msg = createGeneralAlertBubble(
                "✅ อัตราการเต้นหัวใจปกติ",
                `ค่ากลับมาอยู่ในเกณฑ์ปกติแล้ว (${minVal}-${maxVal})`,
                `${bpm} bpm`,
                "#10B981", 
                false
            );
            await lineClient.pushMessage(lineId, { type: 'flex', altText: 'หัวใจปกติแล้ว', contents: msg });
        }
    }

    // อัปเดตสถานะ Alert Flag
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