import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import {
  sendCriticalAlertFlexMessage,
  createGeneralAlertBubble,
} from "@/lib/line/flex-messages";
import { Client } from "@line/bot-sdk";
import { pushStatusMessage } from "@/app/api/webhook/line/route";
import { calculateDistance } from "@/lib/utils";

const lineClient = new Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || "",
  channelSecret: process.env.LINE_CHANNEL_SECRET || "",
});

export const dynamic = 'force-dynamic';

async function handleRequest(request: Request) {
  try {
    const body = await request.json();

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


    let { isAlertZone1Sent, isAlertNearZone2Sent, isAlertZone2Sent } = dependent;

    const statusInt = parseInt(status);

    // Calculate distance server-side if safe zone data is available
    let distInt = parseInt(distance || 0);
    if (safeZoneData && safeZoneData.latitude && safeZoneData.longitude) {
      if (lat !== 0 && lng !== 0) {
        distInt = Math.floor(calculateDistance(lat, lng, safeZoneData.latitude, safeZoneData.longitude));
        console.log(` Server-side distance calc: ${distInt}m (Watch says: ${distance})`);
      }
    }

    if (statusInt === 0 && distInt === 0) {
      return NextResponse.json({ success: true, message: "Glitch Skipped" });
    }

    const r1 = safeZoneData?.radiusLv1 || 100;
    const r2 = safeZoneData?.radiusLv2 || 500;


    const isDistanceCritical = distInt >= r2;
    // SOS button sends NO status field. Status 2 is just "Out of Safe Zone" (ignored in favor of server calc).
    const isManualSOS = (status === undefined || status === null);

    let currentDBStatus: "SAFE" | "WARNING" | "DANGER" = "SAFE";
    let shouldSendLine = false;
    let alertType = "NONE";


    const lastLocation = dependent.locations[0];
    const now = new Date();
    let timeDiffSec = 9999;
    if (lastLocation) {
      timeDiffSec = (now.getTime() - new Date(lastLocation.timestamp).getTime()) / 1000;
    }

    if (isManualSOS) {
      console.log(" Manual SOS Detected!");
      currentDBStatus = "DANGER";
      const recentSOS = await prisma.extendedHelp.findFirst({
        where: { dependentId: dependent.id, type: "WATCH_SOS", requestedAt: { gte: new Date(Date.now() - 60000) } }
      });

      if (!recentSOS && caregiver?.user.lineId) {
        await sendCriticalAlertFlexMessage(
          caregiver.user.lineId,
          { latitude: lat, longitude: lng, timestamp: new Date(), id: 0 },
          user, caregiver.phone || "", dependent as any, "SOS",
          `มีการกดเรียกผู้ดูแล`
        );

        await prisma.extendedHelp.create({
          data: {
            dependentId: dependent.id,
            type: "WATCH_SOS",
            status: "DETECTED",
            latitude: lat,
            longitude: lng,
            reporterId: caregiver.id,
          }
        });
      }
    }



    else {
      let currentStatus = 0;
      if (safeZoneData) {
        const nearR2 = Math.floor(r2 * 0.8);
        if (distInt <= r1) currentStatus = 0;
        else if (distInt < nearR2) currentStatus = 1;
        else if (distInt < r2) currentStatus = 3;
        else currentStatus = 2;
      }

      const buffer = 20;


      if (currentStatus === 0) {
        currentDBStatus = "SAFE";
        if (distInt <= (r1 - buffer)) {
          if (isAlertZone1Sent || isAlertNearZone2Sent || isAlertZone2Sent) {

            if (true) {
              shouldSendLine = true; alertType = "BACK_SAFE";
              isAlertZone1Sent = false;
              isAlertNearZone2Sent = false;
              isAlertZone2Sent = false;
            }
          }
        }
      }

      else if (currentStatus === 1) {
        currentDBStatus = "WARNING";

        if (!isAlertZone1Sent) {
          shouldSendLine = true; alertType = "ZONE_1"; isAlertZone1Sent = true;
        }

        else if (isAlertZone2Sent || isAlertNearZone2Sent) {
          if (distInt <= (Math.floor(r2 * 0.8) - buffer)) {

            if (true) {
              shouldSendLine = true; alertType = "BACK_TO_ZONE_1";
              isAlertZone2Sent = false;
              isAlertNearZone2Sent = false;
            }
          }
        }
      }

      else if (currentStatus === 3) {
        currentDBStatus = "DANGER";


        if (!isAlertNearZone2Sent) {
          shouldSendLine = true; alertType = "NEAR_ZONE_2";
          isAlertNearZone2Sent = true; isAlertZone1Sent = true;
        }

        else if (isAlertZone2Sent) {
          if (distInt <= (r2 - buffer)) {

            if (true) {
              shouldSendLine = true; alertType = "BACK_TO_NEAR_ZONE_2";
              isAlertZone2Sent = false;
            }
          }
        }
      }

      else if (currentStatus === 2) {
        currentDBStatus = "DANGER";


        if (!isAlertZone2Sent) {
          shouldSendLine = true;
          alertType = "ZONE_2_DANGER";

          isAlertZone2Sent = true;
          isAlertNearZone2Sent = true;
          isAlertZone1Sent = true;
        }
      }
    }




    if (shouldSendLine && caregiver?.user.lineId && !isManualSOS) {
      const lineId = caregiver.user.lineId;
      const distText = `${distInt} เมตร`;

      try {
        if (alertType === "BACK_SAFE") {
          const msg = createGeneralAlertBubble("กลับเข้าบ้าน", "กลับเข้ามาในเขตบ้านเรียบร้อยแล้ว", "ปลอดภัย", "#10B981", false);
          await lineClient.pushMessage(lineId, { type: "flex", altText: "กลับเข้าพื้นที่", contents: msg });
        }
        else if (alertType === "ZONE_2_DANGER") {
          await sendCriticalAlertFlexMessage(
            lineId,
            { latitude: lat, longitude: lng, timestamp: new Date(), id: 0 },
            user, caregiver.phone || "", dependent as any,
            "ZONE",
            `️ระยะห่างจากเขตปลอดภัย ${distText}`
          );
        }
        else if (alertType === "ZONE_1") {
          const msg = createGeneralAlertBubble("ออกนอกบ้าน", `พบการออกนอกเขตบ้าน`, distText, "#F59E0B", false);
          await lineClient.pushMessage(lineId, { type: "flex", altText: "เตือนโซน 1", contents: msg });
        }
        else if (alertType === "BACK_TO_ZONE_1") {
          const msg = createGeneralAlertBubble("กลับเข้าเขตปลอดภัย", `กลับเข้ามาในเขตปลอดภัยเรียบร้อยแล้ว`, distText, "#FBBF24", false);
          await lineClient.pushMessage(lineId, { type: "flex", altText: "กลับเข้าโซน 1", contents: msg });
        }
        else if (alertType === "NEAR_ZONE_2") {
          const msg = createGeneralAlertBubble("ใกล้ออกนอกเขตปลอดภัย", `พบความเสี่ยงที่จะออกนอกเขตปลอดภัย`, distText, "#F97316", false);
          await lineClient.pushMessage(lineId, { type: "flex", altText: "เตือนระยะ 80%", contents: msg });
        }
        else if (alertType === "BACK_TO_NEAR_ZONE_2") {
          const msg = createGeneralAlertBubble("กลับเข้าสู่ระยะเฝ้าระวัง", `กลับเข้ามาในระยะเฝ้าระวังเรียบร้อยแล้ว`, distText, "#FB923C", false);
          await lineClient.pushMessage(lineId, { type: "flex", altText: "กลับเข้าสู่ระยะ 80%", contents: msg });
        }
      } catch (lineError: any) {
        console.error(" LINE Send Error:", lineError.statusCode);
      }
    }


    await prisma.dependentProfile.update({
      where: { id: dependent.id },
      data: { isAlertZone1Sent, isAlertNearZone2Sent, isAlertZone2Sent },
    });





    await prisma.location.create({
      data: {
        dependentId: dependent.id,
        latitude: lat, longitude: lng, battery: parseInt(battery || 0),
        distance: distInt, status: currentDBStatus, timestamp: new Date(),
      },
    });


    const activeAlert = await prisma.extendedHelp.findFirst({
      where: { dependentId: dependent.id, status: "DETECTED" },
    });
    let stop_em = !activeAlert;


    if (waitViewLocation) {
      stop_em = false;
      if (body.location_status) {
        await pushStatusMessage(caregiver?.user.lineId!, dependent.id);

        await prisma.dependentProfile.update({ where: { id: dependent.id }, data: { waitViewLocation: false } });
        stop_em = true;
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
    }, {

      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });

  } catch (error) {
    console.error(" Server Error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) { return handleRequest(req); }
export async function PUT(req: Request) { return handleRequest(req); }