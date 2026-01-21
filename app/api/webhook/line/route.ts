import { NextResponse } from "next/server";
import { Client, WebhookEvent } from "@line/bot-sdk";
import prisma from "@/lib/db/prisma";

import {
  createSafetySettingsBubble,
  createCurrentStatusBubble,
  createProfileFlexMessage,
  createWatchConnectionBubble,
  createBorrowReturnFlexMessage,
  createRegisterButtonBubble,
  sendCriticalAlertFlexMessage,
  createLocationNotFoundBubble,
} from "@/lib/line/flex-messages";

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || "",
  channelSecret: process.env.LINE_CHANNEL_SECRET || "",
};

const client = new Client(config);

function validateLineSignature(
  rawBody: string,
  signature: string | undefined
): boolean {
  if (!signature) return false;
  if (rawBody === "") return true;
  return true;
}

export async function POST(req: Request) {
  try {
    const signature = req.headers.get("x-line-signature") || undefined;
    const bodyText = await req.text();

    if (!bodyText || bodyText.length === 0) {
      return NextResponse.json(
        { status: "ok", message: "Verification or empty body received" },
        { status: 200 }
      );
    }

    if (!validateLineSignature(bodyText, signature)) {
      console.warn("️ Invalid LINE signature received.");
    }

    const body = JSON.parse(bodyText);
    const events: WebhookEvent[] = body.events;

    console.log(" EVENT LOG:", JSON.stringify(events, null, 2));

    await Promise.all(
      events.map(async (event) => {

        if (event.type === "join" && event.source.type === "group") {
          const groupId = event.source.groupId;
          console.log(` บอทเข้ากลุ่ม ID: ${groupId}`);
          try {
            await prisma.rescueGroup.deleteMany();
            await prisma.rescueGroup.create({ data: { groupId } });
            await client.replyMessage(event.replyToken, {
              type: "text",
              text: ' บันทึกกลุ่มนี้เป็น "กลุ่มแจ้งเหตุฉุกเฉิน" เรียบร้อยแล้วครับ ',
            });
          } catch (e) {
            console.error("Database Error:", e);
          }
        }

        if (event.type === "leave" && event.source.type === "group") {
          await prisma.rescueGroup.deleteMany({
            where: { groupId: event.source.groupId },
          });
          console.log(" บอทออกจากกลุ่ม - ลบข้อมูลแล้ว");
        }


        if (event.type === "postback") {
          const data = event.postback.data;
          const params = new URLSearchParams(data);
          const action = params.get("action");


          if (action === "resolve_fall") {
            const recordId = parseInt(params.get("id") || "0");
            if (recordId > 0) {
              try {
                const fallRecord = await prisma.fallRecord.findUnique({
                  where: { id: recordId },
                  select: { dependentId: true },
                });

                if (fallRecord) {
                  await prisma.fallRecord.update({
                    where: { id: recordId },
                    data: { status: "RESOLVED" },
                  });


                  await prisma.dependentProfile.update({
                    where: { id: fallRecord.dependentId },
                    data: {
                      isAlertZone1Sent: false,
                      isAlertNearZone2Sent: false,
                      isAlertZone2Sent: false,
                    },
                  });
                }

                await client.replyMessage(event.replyToken, {
                  type: "text",
                  text: " รับทราบครับ ระบบบันทึกว่าท่านได้เข้าช่วยเหลือเรียบร้อยแล้ว",
                });
              } catch (e) {
                console.error("Resolve Fall Error:", e);
                await client.replyMessage(event.replyToken, {
                  type: "text",
                  text: " เกิดข้อผิดพลาดในการบันทึกสถานะ",
                });
              }
            }
          }


          else if (action === "trigger_sos") {
            await handleSosRequest(event.source.userId!, event.replyToken);
          }
        }


        if (event.type === "message" && event.message.type === "text") {
          const userMessage = event.message.text.trim();
          const senderLineId = event.source.userId;
          if (!senderLineId) return;


          if (userMessage === "ตั้งค่าความปลอดภัย") {
            await handleSafetySettingsRequest(senderLineId, event.replyToken);
          }

          else if (
            userMessage === "สถานะปัจจุบัน" ||
            userMessage === "ดูข้อมูลสุขภาพและตำแหน่งปัจจุบัน"
          ) {
            await handleStatusRequest(senderLineId, event.replyToken);
          }

          else if (userMessage === "ดูข้อมูลผู้ใช้งาน") {
            await handleProfileRequest(senderLineId, event.replyToken);
          }

          else if (userMessage === "การเชื่อมต่อนาฬิกา") {
            await handleWatchConnectionRequest(senderLineId, event.replyToken);
          }

          else if (userMessage === "การยืม-คืนครุภัณฑ์") {
            await handleBorrowReturnRequest(senderLineId, event.replyToken);
          }

          else if (
            userMessage.includes("ลงทะเบียน") &&
            event.source.type === "user"
          ) {
            const registerUrl = `${process.env.NEXT_PUBLIC_APP_URL}/register`;
            const flexMsg = createRegisterButtonBubble(registerUrl);

            await client.replyMessage(event.replyToken, {
              type: "flex",
              altText: "กรุณาลงทะเบียนเข้าใช้งาน",
              contents: flexMsg as any,
            });
          }


          else if (userMessage === "ขอความช่วยเหลือ" || userMessage === "แจ้งเหตุฉุกเฉิน") {
            await handleSosRequest(senderLineId, event.replyToken);
          }
        }
      })
    );

    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (error) {
    console.error("Webhook Error:", error);
    return NextResponse.json(
      { status: "error", message: "Internal Server Error" },
      { status: 500 }
    );
  }
}





async function handleSosRequest(lineId: string, replyToken: string) {

  const caregiverUser = await prisma.user.findFirst({
    where: { lineId },
    include: {
      caregiverProfile: {
        include: {
          dependents: {
            include: {
              locations: { orderBy: { timestamp: 'desc' }, take: 1 }
            }
          }
        }
      }
    }
  });


  if (!caregiverUser || !caregiverUser.caregiverProfile || caregiverUser.caregiverProfile.dependents.length === 0) {
    await sendNotRegisteredFlex(replyToken);
    return;
  }

  const dependent = caregiverUser.caregiverProfile.dependents[0];
  const location = dependent.locations[0];
  const caregiver = caregiverUser.caregiverProfile;


  const helpRecord = await prisma.extendedHelp.create({
    data: {
      reporterId: caregiver.id,
      dependentId: dependent.id,
      type: "LINE_SOS",
      status: "DETECTED",
      latitude: location?.latitude || 0,
      longitude: location?.longitude || 0,
      details: `แจ้งเหตุฉุกเฉินเพิ่มเติมผ่าน LINE โดยคุณ ${caregiver.firstName}`,
    }
  });

  // Create System Notification
  await prisma.notification.create({
    data: {
      type: "HELP",
      title: "แจ้งเหตุฉุกเฉิน (LINE)",
      message: `คุณ ${caregiver.firstName} แจ้งขอความช่วยเหลือให้ ${dependent.firstName} ${dependent.lastName}`,
      link: "/admin/dashboard?tab=alerts"
    }
  });


  await client.replyMessage(replyToken, {
    type: "text",
    text: " ระบบได้รับแจ้งเหตุแล้ว! กำลังประสานงานไปยังกลุ่มช่วยเหลือทันทีครับ"
  });


  const rescueGroup = await prisma.rescueGroup.findFirst();

  if (rescueGroup) {
    console.log(` Sending LINE SOS to Group: ${rescueGroup.groupId}`);

    await sendCriticalAlertFlexMessage(
      rescueGroup.groupId,
      {
        latitude: location?.latitude || 0,
        longitude: location?.longitude || 0,
        timestamp: new Date(),
        id: helpRecord.id
      },
      caregiverUser,
      caregiver.phone,
      dependent,
      "SOS",
      ` แจ้งเหตุฉุกเฉินจากญาติ: คุณ ${caregiver.firstName} ขอความช่วยเหลือ!`
    );
  } else {
    console.warn("️ ไม่พบ Rescue Group ในระบบ (บอทยังไม่ได้ถูกเชิญเข้ากลุ่ม หรือไม่ได้ Join)");
  }
}

async function sendNotRegisteredFlex(replyToken: string) {
  const registerUrl = `${process.env.NEXT_PUBLIC_APP_URL}/register`;
  const flexMsg = createRegisterButtonBubble(registerUrl);

  await client.replyMessage(replyToken, {
    type: "flex",
    altText: "ไม่พบข้อมูลลงทะเบียน",
    contents: flexMsg as any,
  });
}

async function handleSafetySettingsRequest(lineId: string, replyToken: string) {
  const caregiverUser = await prisma.user.findFirst({
    where: { lineId },
    include: {
      caregiverProfile: {
        include: {
          dependents: {
            include: {
              safeZones: true,
              tempSetting: true,
              heartRateSetting: true,
            },
          },
        },
      },
    },
  });

  if (!caregiverUser || !caregiverUser.caregiverProfile || caregiverUser.caregiverProfile.dependents.length === 0) {
    await sendNotRegisteredFlex(replyToken);
    return;
  }

  const dependent = caregiverUser.caregiverProfile.dependents[0];
  const settingsValues = {
    safezoneLv1: dependent.safeZones[0]?.radiusLv1 || 0,
    safezoneLv2: dependent.safeZones[0]?.radiusLv2 || 0,
    maxTemp: dependent.tempSetting?.maxTemperature || 37.5,
    maxBpm: dependent.heartRateSetting?.maxBpm || 120,
  };
  const flexMessage = createSafetySettingsBubble(dependent, settingsValues);
  await client.replyMessage(replyToken, {
    type: "flex",
    altText: "เมนูตั้งค่าความปลอดภัย",
    contents: flexMessage as any,
  });
}





async function handleStatusRequest(lineId: string, replyToken: string) {
  const caregiverUser = await prisma.user.findFirst({
    where: { lineId },
    include: {
      caregiverProfile: {
        include: {
          dependents: {
            include: {
              locations: { orderBy: { timestamp: "desc" }, take: 1 },
              heartRateRecords: { orderBy: { timestamp: "desc" }, take: 1 },
              temperatureRecords: { orderBy: { timestamp: "desc" }, take: 1 },
            },
          },
        },
      },
    },
  });

  if (!caregiverUser || !caregiverUser.caregiverProfile || caregiverUser.caregiverProfile.dependents.length === 0) {
    await sendNotRegisteredFlex(replyToken);
    return;
  }

  const dependent = caregiverUser.caregiverProfile.dependents[0];
  const latestLoc = dependent.locations[0];
  const latestHr = dependent.heartRateRecords[0];
  const latestTemp = dependent.temperatureRecords[0];


  if (!dependent.isGpsEnabled) {
    console.log(` GPS OFF: Waking up Dependent: ${dependent.id}`);


    await prisma.dependentProfile.update({
      where: { id: dependent.id },
      data: { waitViewLocation: true, isGpsEnabled: true },
    });

    const waitingFlex = createWaitingGpsBubble();
    await client.replyMessage(replyToken, {
      type: 'flex',
      altText: ' กำลังค้นหาตำแหน่ง...',
      contents: waitingFlex as any
    });
    return;
  }









  // Calculate the latest timestamp from all sources
  const timePoints = [
    latestLoc?.timestamp ? new Date(latestLoc.timestamp).getTime() : 0,
    latestHr?.timestamp ? new Date(latestHr.timestamp).getTime() : 0,
    latestTemp?.timestamp ? new Date(latestTemp.timestamp).getTime() : 0,
  ];
  const maxTime = Math.max(...timePoints);
  const latestTimestamp = maxTime > 0 ? new Date(maxTime) : new Date();

  const healthData = {
    bpm: latestHr?.bpm || 0,
    temp: latestTemp?.value || 0,
    battery: latestLoc?.battery || 0,
    lat: latestLoc?.latitude || 0,
    lng: latestLoc?.longitude || 0,
    updatedAt: latestTimestamp,
  };

  // Check if location is invalid (0,0 or null)
  if (!healthData.lat && !healthData.lng) {
    const flexMessage = createLocationNotFoundBubble();
    await client.replyMessage(replyToken, {
      type: "flex",
      altText: "ไม่พบตำแหน่งปัจจุบัน",
      contents: flexMessage as any,
    });
    return;
  }

  const flexMessage = createCurrentStatusBubble(dependent, healthData);
  await client.replyMessage(replyToken, {
    type: "flex",
    altText: `สถานะปัจจุบัน: คุณ${dependent.firstName}`,
    contents: flexMessage as any,
  });
}


export async function pushStatusMessage(lineId: string, dependentId: number) {
  const dependent = await prisma.dependentProfile.findUnique({
    where: { id: dependentId },
    include: {
      locations: { orderBy: { timestamp: "desc" }, take: 1 },
      heartRateRecords: { orderBy: { timestamp: "desc" }, take: 1 },
      temperatureRecords: { orderBy: { timestamp: "desc" }, take: 1 },
    }
  });

  if (!dependent) {
    console.warn(`️ ไม่พบ Dependent ID: ${dependentId} สำหรับ Push Message`);
    return;
  }

  const latestLoc = dependent.locations[0];
  const latestHr = dependent.heartRateRecords[0];
  const latestTemp = dependent.temperatureRecords[0];

  // Calculate the latest timestamp from all sources
  const timePoints = [
    latestLoc?.timestamp ? new Date(latestLoc.timestamp).getTime() : 0,
    latestHr?.timestamp ? new Date(latestHr.timestamp).getTime() : 0,
    latestTemp?.timestamp ? new Date(latestTemp.timestamp).getTime() : 0,
  ];
  const maxTime = Math.max(...timePoints);
  const latestTimestamp = maxTime > 0 ? new Date(maxTime) : new Date();

  const healthData = {
    bpm: latestHr?.bpm || 0,
    temp: latestTemp?.value || 0,
    battery: latestLoc?.battery || 0,
    lat: latestLoc?.latitude || 0,
    lng: latestLoc?.longitude || 0,
    updatedAt: latestTimestamp,
  };

  const flexMessage = createCurrentStatusBubble(dependent, healthData);

  try {
    await client.pushMessage(lineId, {
      type: "flex",
      altText: `สถานะปัจจุบัน: คุณ${dependent.firstName}`,
      contents: flexMessage,
    });
    console.log(" ส่งสถานะปัจจุบันสำเร็จ");
  } catch (e) {
    console.error("Failed to push status message:", e);
  }
}

async function handleProfileRequest(lineId: string, replyToken: string) {
  const caregiverUser = await prisma.user.findFirst({
    where: { lineId },
    include: { caregiverProfile: { include: { dependents: true } } },
  });

  if (!caregiverUser || !caregiverUser.caregiverProfile) {
    await sendNotRegisteredFlex(replyToken);
    return;
  }

  const caregiverProfile = caregiverUser.caregiverProfile;
  const dependentProfile = caregiverProfile.dependents[0];
  const flexMessage = createProfileFlexMessage(
    caregiverProfile,
    dependentProfile
  );
  await client.replyMessage(replyToken, {
    type: "flex",
    altText: "ข้อมูลลงทะเบียนของคุณ",
    contents: flexMessage as any,
  });
}

async function handleWatchConnectionRequest(
  lineId: string,
  replyToken: string
) {
  const caregiverUser = await prisma.user.findFirst({
    where: { lineId },
    include: {
      caregiverProfile: {
        include: {
          dependents: {
            include: {
              locations: { orderBy: { timestamp: "desc" }, take: 1 },
              user: true,
            },
          },
        },
      },
    },
  });

  if (!caregiverUser || !caregiverUser.caregiverProfile || caregiverUser.caregiverProfile.dependents.length === 0) {
    await sendNotRegisteredFlex(replyToken);
    return;
  }

  const dependent = caregiverUser.caregiverProfile.dependents[0];
  const dependentAccount = dependent.user;
  const latestLoc = dependent.locations[0];
  const isOnline = latestLoc
    ? new Date().getTime() - new Date(latestLoc.timestamp).getTime() <
    5 * 60 * 1000
    : false;
  const flexMessage = createWatchConnectionBubble(
    caregiverUser.caregiverProfile,
    dependent,
    dependentAccount,
    isOnline,
    latestLoc?.timestamp
  );
  await client.replyMessage(replyToken, {
    type: "flex",
    altText: "ข้อมูลการเชื่อมต่อนาฬิกา",
    contents: flexMessage as any,
  });
}

async function handleBorrowReturnRequest(lineId: string, replyToken: string) {
  const caregiverUser = await prisma.user.findFirst({
    where: { lineId },
    include: {
      caregiverProfile: {
        include: {
          borrowRequests: {
            where: { status: { in: ["PENDING", "APPROVED"] } },
            include: { items: { include: { equipment: true } } },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  if (!caregiverUser || !caregiverUser.caregiverProfile) {
    await sendNotRegisteredFlex(replyToken);
    return;
  }

  const activeBorrow = caregiverUser.caregiverProfile.borrowRequests[0] || null;
  const flexMessage = createBorrowReturnFlexMessage(
    caregiverUser.caregiverProfile,
    activeBorrow
  );
  await client.replyMessage(replyToken, {
    type: "flex",
    altText: "เมนูยืม-คืนครุภัณฑ์",
    contents: flexMessage as any,
  });
}




function createWaitingGpsBubble() {
  return {
    "type": "bubble",
    "size": "mega",
    "body": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        {
          "type": "box",
          "layout": "vertical",
          "contents": [
            {
              "type": "text",
              "text": "⏳",
              "size": "3xl",
              "align": "center"
            }
          ],
          "backgroundColor": "#E8F3FF",
          "cornerRadius": "100px",
          "width": "80px",
          "height": "80px",
          "justifyContent": "center",
          "alignItems": "center",
          "margin": "none"
        },
        {
          "type": "text",
          "text": "กำลังเชื่อมต่อนาฬิกา...",
          "weight": "bold",
          "size": "lg",
          "align": "center",
          "margin": "lg",
          "color": "#1D4ED8"
        },
        {
          "type": "text",
          "text": "ระบบกำลังสั่งเปิด GPS และค้นหาตำแหน่งล่าสุด กรุณารอสักครู่",
          "wrap": true,
          "color": "#64748B",
          "size": "sm",
          "align": "center",
          "margin": "md"
        },
        {
          "type": "separator",
          "margin": "xl"
        },
        {
          "type": "box",
          "layout": "horizontal",
          "contents": [
            {
              "type": "text",
              "text": "รอแจ้งเตือน",
              "size": "xs",
              "color": "#94A3B8",
              "align": "center"
            }
          ],
          "margin": "md"
        }
      ],
      "alignItems": "center",
      "paddingAll": "xl"
    },
    "styles": {
      "footer": {
        "separator": true
      }
    }
  };
}