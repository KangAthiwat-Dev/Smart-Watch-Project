import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { createGeneralAlertBubble, sendCriticalAlertFlexMessage } from '@/lib/line/flex-messages'; // ✅ เพิ่ม import นี้
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

    // 🛑 ยันต์กันผี 0.0
    if (currentTemp <= 0) {
        return NextResponse.json({ success: true, message: "Ignored 0.0 temp" });
    }

    // 1. ดึงข้อมูล User, Setting และ Locations
    const user = await prisma.user.findUnique({
      where: { id: parseInt(targetId) },
      include: { 
          dependentProfile: {
              include: {
                  caregiver: { include: { user: true } },
                  tempSetting: true,
                  // ✅ ดึง Location ล่าสุดมาด้วย (เผื่อต้องใช้ใน Map)
                  locations: { take: 1, orderBy: { timestamp: 'desc' } }
              }
          } 
      }
    });

    if (!user || !user.dependentProfile) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const dependent = user.dependentProfile;
    const maxTemp = dependent.tempSetting?.maxTemperature || 37.5; 

    // 2. Logic
    const isAbnormal = (currentTemp > maxTemp);
    const isAlertSent = dependent.isTemperatureAlertSent;

    // ⭐ ย้ายการบันทึก Record มาไว้ตรงนี้ (ก่อนส่ง LINE) ⭐
    // เพื่อให้เรามี record.id ไปแปะในปุ่ม SOS
    const record = await prisma.temperatureRecord.create({
        data: {
            dependentId: dependent.id,
            value: currentTemp,
            status: isAbnormal ? 'ABNORMAL' : 'NORMAL',
            timestamp: new Date(),
        }
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
        console.log(`🌡️ Temp Alert: ${messageType} (${currentTemp} °C)`);

        if (messageType === 'CRITICAL') {
            // ✅ เปลี่ยนมาใช้ sendCriticalAlertFlexMessage เพื่อให้ได้ปุ่ม SOS ที่ถูกต้อง
            await sendCriticalAlertFlexMessage(
                lineId,
                record, // ส่ง record ที่เพิ่งสร้าง
                user,
                dependent.caregiver.phone || '',
                dependent as any,
                'TEMP' // ✅ ระบุ Type ว่าเป็น HEALTH (หรือ TEMP ก็ได้ถ้าอยากแยก)
            );
        } 
        else if (messageType === 'RECOVERY') {
            // (ส่วนสีเขียวใช้แบบเดิมได้)
            const msg = createGeneralAlertBubble(
                "✅ อุณหภูมิร่างกายปกติ",
                "อุณหภูมิลดลงอยู่ในเกณฑ์ปกติแล้ว",
                `${currentTemp.toFixed(1)} °C`,
                "#10B981", 
                false 
            );
            await lineClient.pushMessage(lineId, { type: 'flex', altText: 'อุณหภูมิปกติแล้ว', contents: msg });
        }
    }

    // 4. อัปเดต Flag
    if (newAlertStatus !== isAlertSent) {
        await prisma.dependentProfile.update({
            where: { id: dependent.id },
            data: { isTemperatureAlertSent: newAlertStatus }
        });
    }

    return NextResponse.json({ success: true, data: record });

  } catch (error) {
    console.error("Server Error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) { return handleRequest(req); }
export async function PUT(req: Request) { return handleRequest(req); }