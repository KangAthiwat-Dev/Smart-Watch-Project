import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { sendCriticalAlertFlexMessage, createGeneralAlertBubble } from '@/lib/line/flex-messages';
import { Client } from '@line/bot-sdk';

const lineClient = new Client({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
    channelSecret: process.env.LINE_CHANNEL_SECRET || '',
});

async function handleRequest(request: Request) {
  try {
    const body = await request.json();
    
    // 1. รับค่าจากนาฬิกา
    const targetId = body.uId || body.lineId || body.users_id; 
    const { battery, distance, status } = body;
    
    let rawLat = body.latitude ?? body.lat ?? 0;
    let rawLng = body.longitude ?? body.lng ?? 0;
    const lat = parseFloat(String(rawLat));
    const lng = parseFloat(String(rawLng));

    // // 🛑 กฏเหล็ก 1: ป้องกันพิกัด 0,0 (Ignored)
    if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) {
        return NextResponse.json({ success: true, message: "Ignored 0,0" });
    }

    if (!targetId) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    // 2. ดึงข้อมูล User และสถานะแจ้งเตือน 3 ระดับ จาก DB
    const user = await prisma.user.findUnique({
      where: { id: parseInt(targetId) },
      include: { 
          dependentProfile: {
              include: {
                  caregiver: { include: { user: true } }, 
                  locations: { take: 1, orderBy: { timestamp: 'desc' } },
                  safeZones: { take: 1 } // ✅ ดึง SafeZone มาด้วย
              }
          } 
      }
    });

    if (!user || !user.dependentProfile) {
      return NextResponse.json({ success: false, message: 'Profile not found' }, { status: 404 });
    }

    const dependent = user.dependentProfile;
    const caregiver = dependent.caregiver;

    // 3. เตรียมตัวแปร Flag เดิม
    let { isAlertZone1Sent, isAlertNearZone2Sent, isAlertZone2Sent } = dependent;
    
    // แปลงค่าอินพุต
    const statusInt = parseInt(status);
    const distInt = parseInt(distance || 0);

    // 🛑 กฏเหล็ก 2: ป้องกัน Startup Glitch (สถานะ SAFE แต่ระยะเป็น 0)
    if (statusInt === 0 && distInt === 0) {
        console.log("⚠️ Startup Glitch (Status 0, Dist 0) -> Skipped.");
        return NextResponse.json({ success: true, message: "Glitch Skipped" });
    }

    // 4. 🧠 Logic แจ้งเตือนอัจฉริยะ (State Machine)
    let shouldSendLine = false;
    let alertType = 'NONE';
    let currentDBStatus: 'SAFE' | 'WARNING' | 'DANGER' = 'SAFE';

    // --- กรณี 1: ปลอดภัย (SAFE) ---
    if (statusInt === 0) {
        currentDBStatus = 'SAFE';
        // ถ้าเคยแจ้งเตือนอะไรไปบ้าง ให้บอกว่ากลับถึงบ้านแล้ว
        if (isAlertZone1Sent || isAlertNearZone2Sent || isAlertZone2Sent) {
            shouldSendLine = true;
            alertType = 'BACK_SAFE';
            // รีเซ็ตหมด
            isAlertZone1Sent = false;
            isAlertNearZone2Sent = false;
            isAlertZone2Sent = false;
        }
    }
    // --- กรณี 2: อยู่เขตชั้น 1 (WARNING) ---
    else if (statusInt === 1) {
        currentDBStatus = 'WARNING';
        
        // (A) ขาออก: ยังไม่เคยแจ้งชั้น 1 -> แจ้งเลย
        if (!isAlertZone1Sent) { 
            shouldSendLine = true;
            alertType = 'ZONE_1';
            isAlertZone1Sent = true; 
        }
        // (B) ⭐ ขาเข้า: เคยไปถึงชั้น 2 (แดง/ส้ม) แล้วถอยกลับมาชั้น 1 -> แจ้งว่ากลับเข้าชั้น 1
        else if (isAlertZone2Sent || isAlertNearZone2Sent) {
            shouldSendLine = true;
            alertType = 'BACK_TO_ZONE_1'; // ✨ Type ใหม่สำหรับขาเข้า
            
            // รีเซ็ต Flag ของชั้นที่สูงกว่า (เคลียร์สถานะแดงออก)
            isAlertZone2Sent = false;
            isAlertNearZone2Sent = false;
            // แต่ยังคง isAlertZone1Sent = true ไว้ (เพราะยังอยู่ในชั้น 1)
        }
    }
    // --- กรณี 3: ระยะ 80% (NEAR DANGER) ---
    else if (statusInt === 3) {
        currentDBStatus = 'DANGER'; 
        // (A) ขาออก
        if (!isAlertNearZone2Sent) { 
            shouldSendLine = true;
            alertType = 'NEAR_ZONE_2';
            isAlertNearZone2Sent = true; 
            isAlertZone1Sent = true; 
        }
        // (B) ขาเข้า: เคยไปสุดขอบแดง (SOS) แล้วถอยกลับมา 80% (อันนี้อาจจะไม่ต้องแจ้งก็ได้ หรือจะแจ้งก็ได้)
        // แต่ปกติถอยจากแดงมา 80% มันใกล้กันมาก อาจจะไม่ต้องเตือน (กันรำคาญ)
        else if (isAlertZone2Sent) {
             isAlertZone2Sent = false; // แค่ลดระดับ Flag เงียบๆ พอ
        }
    }
    // --- กรณี 4: หลุดเขตชั้น 2 (DANGER / SOS) ---
    else if (statusInt === 2) {
        currentDBStatus = 'DANGER';
        if (!isAlertZone2Sent) { 
            shouldSendLine = true;
            alertType = 'ZONE_2_SOS';
            isAlertZone2Sent = true;
            isAlertNearZone2Sent = true;
            isAlertZone1Sent = true;
        }
    }

    // 5. ส่ง LINE (เพิ่มเงื่อนไข BACK_TO_ZONE_1)
    if (shouldSendLine && caregiver?.user.lineId) {
        const lineId = caregiver.user.lineId;
        const distText = `${distInt} ม.`;
        console.log(`🔔 Sending Alert: ${alertType}`);

        if (alertType === 'BACK_SAFE') {
            const msg = createGeneralAlertBubble("✅ กลับเข้าสู่พื้นที่ปลอดภัย", "ผู้ป่วยกลับเข้ามาในเขตบ้านเรียบร้อยแล้ว", "ปลอดภัย", "#10B981", false);
            await lineClient.pushMessage(lineId, { type: 'flex', altText: 'กลับเข้าพื้นที่', contents: msg });
        }
        else if (alertType === 'ZONE_1') {
            const msg = createGeneralAlertBubble("⚠️ ออกนอกพื้นที่ชั้นใน", `ผู้ป่วยออกห่างจากจุดศูนย์กลาง (ระยะ ${distText})`, distText, "#F59E0B", false);
            await lineClient.pushMessage(lineId, { type: 'flex', altText: 'แจ้งเตือนโซน 1', contents: msg });
        }
        // ✨ เพิ่ม: การ์ดแจ้งเตือนตอนเดินกลับเข้ามา Zone 1 ✨
        else if (alertType === 'BACK_TO_ZONE_1') {
            const msg = createGeneralAlertBubble("⚠️ กลับเข้าสู่เขตชั้น 1", `ผู้ป่วยเดินกลับเข้ามาในเขตเฝ้าระวัง (ระยะ ${distText})`, distText, "#FBBF24", false);
            await lineClient.pushMessage(lineId, { type: 'flex', altText: 'กลับเข้าโซน 1', contents: msg });
        }
        else if (alertType === 'NEAR_ZONE_2') {
            // ... (เหมือนเดิม) ...
            const msg = createGeneralAlertBubble("⚠️ ใกล้หลุดเขตปลอดภัย (80%)", `ผู้ป่วยเคลื่อนที่ใกล้ขอบเขตปลอดภัยชั้นที่ 2 (ระยะ ${distText})`, distText, "#F97316", false);
            await lineClient.pushMessage(lineId, { type: 'flex', altText: 'แจ้งเตือนระยะ 80%', contents: msg });
        }
        else if (alertType === 'ZONE_2_SOS') {
            // ... (เหมือนเดิม) ...
            await sendCriticalAlertFlexMessage(
                lineId,
                { latitude: lat, longitude: lng, timestamp: new Date(), id: 0 },
                user,
                caregiver.phone || '',
                dependent as any,
                'ZONE'
            );
        }
    }

    // 6. อัปเดต Flag ใหม่ลง DB
    await prisma.dependentProfile.update({
        where: { id: dependent.id },
        data: { isAlertZone1Sent, isAlertNearZone2Sent, isAlertZone2Sent }
    });

    // 7. บันทึก Location History
    await prisma.location.create({
      data: {
        dependentId: dependent.id,
        latitude: lat,
        longitude: lng,
        battery: parseInt(battery || 0),
        distance: distInt,
        status: currentDBStatus,
        timestamp: new Date(),
      },
    });

    // 8. Return Response
    const activeAlert = await prisma.extendedHelp.findFirst({
        where: { dependentId: dependent.id, status: 'DETECTED' }
    });

    // ✅ เตรียมข้อมูล SafeZone เพื่อส่งกลับให้นาฬิกา (Sync)
    const safeZoneData = dependent.safeZones[0];

    return NextResponse.json({ 
        success: true, 
        command_tracking: dependent.isGpsEnabled, 
        request_location: !!activeAlert,
        stop_emergency: !activeAlert,
        
        // ⭐⭐⭐ เพิ่มท่อนนี้ครับ! ส่งค่า R1, R2 กลับไปให้นาฬิกาอัปเดต ⭐⭐⭐
        sync_settings: {
            r1: safeZoneData?.radiusLv1 || 100,
            r2: safeZoneData?.radiusLv2 || 500,
            lat: safeZoneData?.latitude || 0.0,
            lng: safeZoneData?.longitude || 0.0
        }
    });

  } catch (error) {
    console.error("💥 Server Error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) { return handleRequest(req); }
export async function PUT(req: Request) { return handleRequest(req); }