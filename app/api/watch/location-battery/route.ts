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

export const dynamic = 'force-dynamic';

async function handleRequest(request: Request) {
  try {
    const body = await request.json();

    // 1. รับค่า
    const targetId = body.uId || body.lineId || body.users_id;
    const { battery, distance, status } = body;
    let rawLat = body.latitude ?? body.lat ?? 0;
    let rawLng = body.longitude ?? body.lng ?? 0;
    const lat = parseFloat(String(rawLat));
    const lng = parseFloat(String(rawLng));

    if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) {
      return NextResponse.json({ success: true, message: "Ignored 0,0" });
    }

    if (!targetId) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    // 2. ดึงข้อมูล
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
      return NextResponse.json({ success: false, message: "Profile not found" }, { status: 404 });
    }

    const dependent = user.dependentProfile;
    const caregiver = dependent.caregiver;
    const safeZoneData = dependent.safeZones[0];
    const waitViewLocation = dependent.waitViewLocation ?? false;
    
    // Flag สถานะ
    let { isAlertZone1Sent, isAlertNearZone2Sent, isAlertZone2Sent } = dependent;

    const statusInt = parseInt(status);
    const distInt = parseInt(distance || 0);

    if (statusInt === 0 && distInt === 0) {
      return NextResponse.json({ success: true, message: "Glitch Skipped" });
    }

    const r1 = safeZoneData?.radiusLv1 || 100;
    const r2 = safeZoneData?.radiusLv2 || 500;
    
    // Logic แยก SOS vs Zone
    const isDistanceCritical = distInt >= r2; 
    const isManualSOS = (statusInt === 2) && !isDistanceCritical;

    let currentDBStatus: "SAFE" | "WARNING" | "DANGER" = "SAFE";
    let shouldSendLine = false;
    let alertType = "NONE";

    // 🕒 TIME LOCK
    const lastLocation = dependent.locations[0];
    const now = new Date();
    let timeDiffSec = 9999; 
    if (lastLocation) {
        timeDiffSec = (now.getTime() - new Date(lastLocation.timestamp).getTime()) / 1000;
    }

    // ==========================================
    // 🚨 CASE 1: MANUAL SOS (กดปุ่ม)
    // ==========================================
    if (isManualSOS) {
        console.log("🚨 Manual SOS Detected!");
        currentDBStatus = "DANGER";
        const recentSOS = await prisma.extendedHelp.findFirst({
            where: { dependentId: dependent.id, type: "WATCH_SOS", requestedAt: { gte: new Date(Date.now() - 60000) } }
        });

        if (!recentSOS && caregiver?.user.lineId) {
             await sendCriticalAlertFlexMessage(
              caregiver.user.lineId,
              { latitude: lat, longitude: lng, timestamp: new Date(), id: 0 },
              user, caregiver.phone || "", dependent as any, "SOS", 
              `🆘 แจ้งเตือน: ${dependent.firstName} กดปุ่มขอความช่วยเหลือ!`
            );
        }
    }
    // ==========================================
    // 🌍 CASE 2: ZONE LOGIC
    // ==========================================
    else {
      let currentStatus = 0; 
      if (safeZoneData) {
        const nearR2 = Math.floor(r2 * 0.8);
        if (distInt <= r1) currentStatus = 0;      
        else if (distInt < nearR2) currentStatus = 1; 
        else if (distInt < r2) currentStatus = 3;     
        else currentStatus = 2; // DANGER
      }

      const buffer = 20;

      // 🟢 SAFE (0)
      if (currentStatus === 0) {
        currentDBStatus = "SAFE";
        if (distInt <= (r1 - buffer)) {
            if (isAlertZone1Sent || isAlertNearZone2Sent || isAlertZone2Sent) {
                // ต้องอยู่ในบ้านเกิน 10 วิ ถึงจะแจ้งว่ากลับบ้าน (กันเด้ง)
                if (timeDiffSec > 10) { 
                    shouldSendLine = true; alertType = "BACK_SAFE";
                    isAlertZone1Sent = false; 
                    isAlertNearZone2Sent = false; 
                    isAlertZone2Sent = false;
                }
            }
        }
      } 
      // 🟡 ZONE 1 (1)
      else if (currentStatus === 1) {
        currentDBStatus = "WARNING";
        // ขาออก
        if (!isAlertZone1Sent) { 
            shouldSendLine = true; alertType = "ZONE_1"; isAlertZone1Sent = true; 
        }
        // ขาเข้า (จาก Zone 2/Near)
        else if (isAlertZone2Sent || isAlertNearZone2Sent) {
            if (distInt <= (Math.floor(r2 * 0.8) - buffer)) {
                // ต้องกลับเข้ามานานเกิน 30 วิ ถึงจะแจ้ง
                if (timeDiffSec > 30) {
                    shouldSendLine = true; alertType = "BACK_TO_ZONE_1";
                    isAlertZone2Sent = false;
                    isAlertNearZone2Sent = false;
                }
            }
        }
      } 
      // 🟠 NEAR ZONE 2 (3) - 80%
      else if (currentStatus === 3) {
          currentDBStatus = "DANGER"; 
          
          // ขาออก (เพิ่งแตะ 80%)
          if (!isAlertNearZone2Sent) {
              shouldSendLine = true; alertType = "NEAR_ZONE_2";
              isAlertNearZone2Sent = true; isAlertZone1Sent = true; 
          }
          // ขาเข้า (กลับมาจาก Zone 2)
          else if (isAlertZone2Sent) {
             if (distInt <= (r2 - buffer)) {
                 // ต้องกลับเข้ามานานเกิน 30 วิ ถึงจะแจ้ง
                 if (timeDiffSec > 30) {
                     shouldSendLine = true; alertType = "BACK_TO_NEAR_ZONE_2";
                     isAlertZone2Sent = false;
                 }
             }
          }
      }
      // 🔴 ZONE 2 DANGER (2)
      else if (currentStatus === 2) {
        currentDBStatus = "DANGER"; 
        
        // Logic: ถ้า Flag ยังไม่เปิด -> แจ้งเลย!
        if (!isAlertZone2Sent) { 
          shouldSendLine = true; 
          alertType = "ZONE_2_DANGER"; 
          
          isAlertZone2Sent = true; 
          isAlertNearZone2Sent = true; 
          isAlertZone1Sent = true;
        } 
      }
    }

    // ==========================================
    // 📨 SEND LINE MESSAGES
    // ==========================================
    if (shouldSendLine && caregiver?.user.lineId && !isManualSOS) {
       const lineId = caregiver.user.lineId;
       const distText = `${distInt} ม.`;
       
       try {
           if (alertType === "BACK_SAFE") {
               const msg = createGeneralAlertBubble("กลับเข้าสู่พื้นที่ปลอดภัย", "ผู้ป่วยกลับเข้ามาในเขตบ้านเรียบร้อยแล้ว", "ปลอดภัย", "#10B981", false);
               await lineClient.pushMessage(lineId, { type: "flex", altText: "กลับเข้าพื้นที่", contents: msg });
           } 
           else if (alertType === "ZONE_2_DANGER") {
               await sendCriticalAlertFlexMessage(
                  lineId,
                  { latitude: lat, longitude: lng, timestamp: new Date(), id: 0 },
                  user, caregiver.phone || "", dependent as any, 
                  "ZONE", 
                  `⚠️ แจ้งเตือน: ${dependent.firstName} ออกนอกเขตปลอดภัย! (ระยะ ${distText})`
               );
           }
           else if (alertType === "ZONE_1") {
               const msg = createGeneralAlertBubble("ออกนอกพื้นที่ชั้นใน", `ระยะ ${distText}`, distText, "#F59E0B", false);
               await lineClient.pushMessage(lineId, { type: "flex", altText: "เตือนโซน 1", contents: msg });
           } 
           else if (alertType === "BACK_TO_ZONE_1") {
               const msg = createGeneralAlertBubble("กลับเข้าสู่เขตชั้น 1", `ระยะ ${distText}`, distText, "#FBBF24", false);
               await lineClient.pushMessage(lineId, { type: "flex", altText: "กลับเข้าโซน 1", contents: msg });
           } 
           else if (alertType === "NEAR_ZONE_2") {
               const msg = createGeneralAlertBubble("ใกล้หลุดเขตปลอดภัย", `ระยะ ${distText}`, distText, "#F97316", false);
               await lineClient.pushMessage(lineId, { type: "flex", altText: "เตือนระยะ 80%", contents: msg });
           }
           else if (alertType === "BACK_TO_NEAR_ZONE_2") {
               const msg = createGeneralAlertBubble("กลับเข้าสู่ระยะเฝ้าระวัง (80%)", `ระยะ ${distText}`, distText, "#FB923C", false);
               await lineClient.pushMessage(lineId, { type: "flex", altText: "กลับเข้าสู่ระยะ 80%", contents: msg });
           }
       } catch (lineError: any) {
           console.error("❌ LINE Send Error:", lineError.statusCode);
       }
    }

    // อัปเดต Flag
    await prisma.dependentProfile.update({
      where: { id: dependent.id },
      data: { isAlertZone1Sent, isAlertNearZone2Sent, isAlertZone2Sent },
    });

    // ==========================================
    // 🔥 REALTIME SAVE: บันทึกทุกครั้ง (แก้ให้แล้ว)
    // ==========================================
    // ตัด Logic เช็ค 5 นาทีทิ้งไปเลย เพื่อให้แผนที่ขยับตลอด
    await prisma.location.create({
      data: {
        dependentId: dependent.id,
        latitude: lat, longitude: lng, battery: parseInt(battery || 0),
        distance: distInt, status: currentDBStatus, timestamp: new Date(),
      },
    });

    // Sync Response
    const activeAlert = await prisma.extendedHelp.findFirst({
      where: { dependentId: dependent.id, status: "DETECTED" },
    });
    let stop_em = !activeAlert;
    
    // Check waitViewLocation
    if (waitViewLocation) {
      stop_em = false;
      if (body.location_status) {
        await pushStatusMessage(caregiver?.user.lineId!, dependent.id);
        // Reset Flag เมื่อส่งแล้ว
        await prisma.dependentProfile.update({ where: { id: dependent.id }, data: { waitViewLocation: false } });
        stop_em = true;
      }
    }

    return NextResponse.json({
      success: true,
      command_tracking: dependent.isGpsEnabled, // ส่งคำสั่งเปิด GPS
      request_location: !!activeAlert,
      stop_emergency: stop_em,
      sync_settings: {
        r1: safeZoneData?.radiusLv1 || 100,
        r2: safeZoneData?.radiusLv2 || 500,
        lat: safeZoneData?.latitude || 0.0,
        lng: safeZoneData?.longitude || 0.0,
      },
    }, { 
      // 🔥 Headers แก้ 304 (Cache)
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });

  } catch (error) {
    console.error("💥 Server Error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) { return handleRequest(req); }
export async function PUT(req: Request) { return handleRequest(req); }