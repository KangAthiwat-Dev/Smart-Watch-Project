import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import {
  sendCriticalAlertFlexMessage,
  createGeneralAlertBubble,
} from "@/lib/line/flex-messages";
import { Client } from "@line/bot-sdk";
import { pushStatusMessage } from "@/app/api/webhook/line/route";

const lineClient = new Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || "",
  channelSecret: process.env.LINE_CHANNEL_SECRET || "",
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

    // ป้องกันพิกัด 0,0
    if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) {
      return NextResponse.json({ success: true, message: "Ignored 0,0" });
    }

    if (!targetId)
      return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    // 2. ดึงข้อมูล User
    const user = await prisma.user.findUnique({
      where: { id: parseInt(targetId) },
      include: {
        dependentProfile: {
          include: {
            caregiver: { include: { user: true } },
            locations: { take: 1, orderBy: { timestamp: "desc" } },
            safeZones: { take: 1 },
          },
        },
      },
    });

    if (!user || !user.dependentProfile) {
      return NextResponse.json(
        { success: false, message: "Profile not found" },
        { status: 404 }
      );
    }

    const dependent = user.dependentProfile;
    const caregiver = dependent.caregiver;
    const safeZoneData = dependent.safeZones[0];
    const waitViewLocation = dependent.waitViewLocation ?? false;

    // เตรียมตัวแปร Flag
    let { isAlertZone1Sent, isAlertNearZone2Sent, isAlertZone2Sent } = dependent;

    const statusInt = parseInt(status);
    const distInt = parseInt(distance || 0);

    if (statusInt === 0 && distInt === 0) {
      return NextResponse.json({ success: true, message: "Glitch Skipped" });
    }

    let currentDBStatus: "SAFE" | "WARNING" | "DANGER" = "SAFE";
    let shouldSendLine = false;
    let alertType = "NONE";

    // ✅ FIX 1: ดักจับ Manual SOS
    const isManualSOS = statusInt === 2; 

    if (isManualSOS) {
        console.log("🚨 Manual SOS Detected from Watch!");
        currentDBStatus = "DANGER";

        if (caregiver?.user.lineId) {
             await sendCriticalAlertFlexMessage(
              caregiver.user.lineId,
              { latitude: lat, longitude: lng, timestamp: new Date(), id: 0 },
              user,
              caregiver.phone || "",
              dependent as any,
              "SOS", 
              `🆘 แจ้งเตือน: ${dependent.firstName} กดปุ่มขอความช่วยเหลือ!`
            );
        }
    } 
    // ✅ FIX 2: Logic โซน (ทำงานแยกอิสระจากการล้ม)
    else {
      let currentStatus = 0; // Default SAFE

      if (safeZoneData) {
        const r1 = safeZoneData.radiusLv1;
        const r2 = safeZoneData.radiusLv2;
        const nearR2 = Math.floor(r2 * 0.8);

        if (distInt <= r1) currentStatus = 0;      // SAFE
        else if (distInt < nearR2) currentStatus = 1; // ZONE 1
        else if (distInt < r2) currentStatus = 3;     // NEAR DANGER (80%)
        else currentStatus = 2;                       // DANGER (ZONE 2)
      }

      // --- Logic แจ้งเตือนตามระยะ (เพิ่มขาเข้า 80%) ---
      
      // 🟢 อยู่ใน Safe Zone
      if (currentStatus === 0) {
        currentDBStatus = "SAFE";
        if (isAlertZone1Sent || isAlertNearZone2Sent || isAlertZone2Sent) {
          shouldSendLine = true; alertType = "BACK_SAFE";
          isAlertZone1Sent = false; isAlertNearZone2Sent = false; isAlertZone2Sent = false;
        }
      } 
      // 🟡 อยู่ใน Zone 1 (Warning)
      else if (currentStatus === 1) {
        currentDBStatus = "WARNING";
        if (!isAlertZone1Sent) { 
            // ขาออก: เพิ่งหลุด Safe -> Zone 1
            shouldSendLine = true; alertType = "ZONE_1"; isAlertZone1Sent = true; 
        }
        else if (isAlertZone2Sent || isAlertNearZone2Sent) {
          // ขาเข้า: กลับมาจาก Zone 2 หรือ 80% -> Zone 1
          shouldSendLine = true; alertType = "BACK_TO_ZONE_1";
          isAlertZone2Sent = false; isAlertNearZone2Sent = false;
        }
      } 
      // 🟠 อยู่ในระยะ 80% (Near Zone 2)
      else if (currentStatus === 3) {
        currentDBStatus = "DANGER";
        if (!isAlertNearZone2Sent) {
          // ขาออก: จาก Zone 1 -> 80%
          shouldSendLine = true; alertType = "NEAR_ZONE_2";
          isAlertNearZone2Sent = true; isAlertZone1Sent = true;
        } else if (isAlertZone2Sent) { 
          // ✅ ขาเข้า (NEW): กลับมาจาก Zone 2 -> 80%
          shouldSendLine = true; alertType = "BACK_TO_NEAR_ZONE_2"; // แจ้งเตือนจุดนี้เพิ่ม
          isAlertZone2Sent = false; 
        }
      } 
      // 🔴 อยู่ใน Zone 2 (Danger)
      else if (currentStatus === 2) {
        currentDBStatus = "DANGER";
        if (!isAlertZone2Sent) {
          shouldSendLine = true; alertType = "ZONE_2_SOS";
          isAlertZone2Sent = true; isAlertNearZone2Sent = true; isAlertZone1Sent = true;
        }
      }
    }

    // ส่ง LINE
    if (shouldSendLine && caregiver?.user.lineId && !isManualSOS) {
       const lineId = caregiver.user.lineId;
       const distText = `${distInt} ม.`;
       
       if (alertType === "BACK_SAFE") {
           const msg = createGeneralAlertBubble("กลับเข้าสู่พื้นที่ปลอดภัย", "ผู้ป่วยกลับเข้ามาในเขตบ้านเรียบร้อยแล้ว", "ปลอดภัย", "#10B981", false);
           await lineClient.pushMessage(lineId, { type: "flex", altText: "กลับเข้าพื้นที่", contents: msg });
       } else if (alertType === "ZONE_1") {
           const msg = createGeneralAlertBubble("ออกนอกพื้นที่ชั้นใน", `ระยะ ${distText}`, distText, "#F59E0B", false);
           await lineClient.pushMessage(lineId, { type: "flex", altText: "เตือนโซน 1", contents: msg });
       } else if (alertType === "BACK_TO_ZONE_1") {
           const msg = createGeneralAlertBubble("กลับเข้าสู่เขตชั้น 1", `ระยะ ${distText}`, distText, "#FBBF24", false);
           await lineClient.pushMessage(lineId, { type: "flex", altText: "กลับเข้าโซน 1", contents: msg });
       } else if (alertType === "NEAR_ZONE_2") {
           const msg = createGeneralAlertBubble("ใกล้หลุดเขตปลอดภัย", `ระยะ ${distText}`, distText, "#F97316", false);
           await lineClient.pushMessage(lineId, { type: "flex", altText: "เตือนระยะ 80%", contents: msg });
       } 
       // ✅ เพิ่มเงื่อนไขแจ้งเตือนขาเข้า 80%
       else if (alertType === "BACK_TO_NEAR_ZONE_2") {
           const msg = createGeneralAlertBubble("กลับเข้าสู่ระยะเฝ้าระวัง (80%)", `ระยะ ${distText}`, distText, "#FB923C", false); // สีส้มอ่อน
           await lineClient.pushMessage(lineId, { type: "flex", altText: "กลับเข้าสู่ระยะ 80%", contents: msg });
       }
       else if (alertType === "ZONE_2_SOS") {
           await sendCriticalAlertFlexMessage(
              lineId, { latitude: lat, longitude: lng, timestamp: new Date(), id: 0 },
              user, caregiver.phone || "", dependent as any, "ZONE",
              `แจ้งเตือน: ${dependent.firstName} ออกนอกเขตพื้นที่!`
            );
       }
    }

    // อัปเดต Flag
    await prisma.dependentProfile.update({
      where: { id: dependent.id },
      data: { isAlertZone1Sent, isAlertNearZone2Sent, isAlertZone2Sent },
    });

    // Save Location Logic
    const lastLocation = await prisma.location.findFirst({
      where: { dependentId: dependent.id }, orderBy: { timestamp: "desc" },
    });
    
    let shouldSave = false;
    if (!lastLocation) shouldSave = true;
    else {
        const statusChanged = lastLocation.status !== currentDBStatus;
        const timeDiff = new Date().getTime() - new Date(lastLocation.timestamp).getTime();
        const minutesPassed = timeDiff / (1000 * 60);
        if (statusChanged || minutesPassed >= 5 || isManualSOS) shouldSave = true; 
    }

    if (shouldSave) {
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
    }

    // Sync & Response
    const activeAlert = await prisma.extendedHelp.findFirst({
      where: { dependentId: dependent.id, status: "DETECTED" },
    });

    let stop_em = !activeAlert;
    if (waitViewLocation) {
      stop_em = false;
      if (body.location_status) {
        await pushStatusMessage(caregiver?.user.lineId!, dependent.id);
        stop_em = true;
        await prisma.dependentProfile.update({ where: { id: dependent.id }, data: { waitViewLocation: false } });
      }
    }

    return NextResponse.json({
      success: true,
      command_tracking: dependent.isGpsEnabled,
      request_location: !!activeAlert,
      stop_emergency: stop_em,
      sync_settings: {
        r1: safeZoneData?.radiusLv1 || 100,
        r2: safeZoneData?.radiusLv2 || 500,
        lat: safeZoneData?.latitude || 0.0,
        lng: safeZoneData?.longitude || 0.0,
      },
    });

  } catch (error) {
    console.error("💥 Server Error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) { return handleRequest(req); }
export async function PUT(req: Request) { return handleRequest(req); }