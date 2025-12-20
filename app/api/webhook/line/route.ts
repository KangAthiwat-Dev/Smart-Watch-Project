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
      console.warn("⚠️ Invalid LINE signature received.");
    }

    const body = JSON.parse(bodyText);
    const events: WebhookEvent[] = body.events;

    console.log("🔥 EVENT LOG:", JSON.stringify(events, null, 2));

    await Promise.all(
      events.map(async (event) => {
        // 🟢 PART 1: Rescue Group Logic
        if (event.type === "join" && event.source.type === "group") {
          const groupId = event.source.groupId;
          console.log(`🤖 บอทเข้ากลุ่ม ID: ${groupId}`);
          try {
            await prisma.rescueGroup.deleteMany();
            await prisma.rescueGroup.create({ data: { groupId } });
            await client.replyMessage(event.replyToken, {
              type: "text",
              text: '✅ บันทึกกลุ่มนี้เป็น "กลุ่มแจ้งเหตุฉุกเฉิน" เรียบร้อยแล้วครับ 🚑',
            });
          } catch (e) {
            console.error("Database Error:", e);
          }
        }

        if (event.type === "leave" && event.source.type === "group") {
          await prisma.rescueGroup.deleteMany({
            where: { groupId: event.source.groupId },
          });
          console.log("👋 บอทออกจากกลุ่ม - ลบข้อมูลแล้ว");
        }

        // 🟢 PART 3: Postback Action
        if (event.type === "postback") {
          const data = event.postback.data;
          const params = new URLSearchParams(data);
          const action = params.get("action");

          // --- Action: ปิดเคสล้ม (Resolve Fall) ---
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

                  // รีเซ็ต Flag โซน
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
                  text: "✅ รับทราบครับ ระบบบันทึกว่าท่านได้เข้าช่วยเหลือเรียบร้อยแล้ว",
                });
              } catch (e) {
                console.error("Resolve Fall Error:", e);
                await client.replyMessage(event.replyToken, {
                  type: "text",
                  text: "❌ เกิดข้อผิดพลาดในการบันทึกสถานะ",
                });
              }
            }
          }
          // --- Action: ขอความช่วยเหลือ (LINE SOS) ---
          // เผื่อในอนาคตใช้ปุ่ม Postback แทน Text Message
          else if (action === "trigger_sos") {
              await handleSosRequest(event.source.userId!, event.replyToken);
          }
        }

        // 🟡 PART 2: Message Logic
        if (event.type === "message" && event.message.type === "text") {
          const userMessage = event.message.text.trim();
          const senderLineId = event.source.userId;
          if (!senderLineId) return;

          // --- 1. ตั้งค่าความปลอดภัย ---
          if (userMessage === "ตั้งค่าความปลอดภัย") {
            await handleSafetySettingsRequest(senderLineId, event.replyToken);
          }
          // --- 2. สถานะปัจจุบัน ---
          else if (
            userMessage === "สถานะปัจจุบัน" ||
            userMessage === "ดูข้อมูลสุขภาพ"
          ) {
            await handleStatusRequest(senderLineId, event.replyToken);
          }
          // --- 3. ข้อมูลรายละเอียด ---
          else if (userMessage === "ข้อมูลรายละเอียด") {
            await handleProfileRequest(senderLineId, event.replyToken);
          }
          // --- 4. การเชื่อมต่อนาฬิกา ---
          else if (userMessage === "ข้อมูลการเชื่อมต่อนาฬิกา") {
            await handleWatchConnectionRequest(senderLineId, event.replyToken);
          }
          // --- 5. การยืม-คืนครุภัณฑ์ ---
          else if (userMessage === "การยืม-คืนครุภัณฑ์") {
            await handleBorrowReturnRequest(senderLineId, event.replyToken);
          }
          // --- 6. ลงทะเบียน ---
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
          // --- 7. ขอความช่วยเหลือ (SOS) ---
          // อันนี้คีย์เวิร์ดสำคัญ! ถ้านายน้อยตั้ง Rich Menu เป็นคำนี้
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

// ============================================================
// 🛠️ Helper Functions
// ============================================================
// ฟังก์ชันจัดการ SOS จาก LINE (Admin Web + Rescue Group)
async function handleSosRequest(lineId: string, replyToken: string) {
    // 1. ดึงข้อมูล User และ Dependent
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

    // ถ้าไม่เจอ user ให้ส่งปุ่มลงทะเบียน
    if (!caregiverUser || !caregiverUser.caregiverProfile || caregiverUser.caregiverProfile.dependents.length === 0) {
        await sendNotRegisteredFlex(replyToken);
        return;
    }

    const dependent = caregiverUser.caregiverProfile.dependents[0];
    const location = dependent.locations[0];
    const caregiver = caregiverUser.caregiverProfile;

    // 2. บันทึกลง DB (เพื่อให้ขึ้นหน้า Admin Web) ✅
    const helpRecord = await prisma.extendedHelp.create({
        data: {
            reporterId: caregiver.id,
            dependentId: dependent.id,
            type: "LINE_SOS", // Type นี้จะไปโชว์ในหน้า Admin
            status: "DETECTED",
            latitude: location?.latitude || 0,
            longitude: location?.longitude || 0,
            details: `แจ้งเหตุฉุกเฉินเพิ่มเติมผ่าน LINE โดยคุณ ${caregiver.firstName}`,
        }
    });

    // 3. ตอบกลับผู้ใช้ในแชทส่วนตัว ✅
    await client.replyMessage(replyToken, {
        type: "text",
        text: "🚨 ระบบได้รับแจ้งเหตุแล้ว! กำลังประสานงานไปยังกลุ่มช่วยเหลือทันทีครับ"
    });

    // 4. ส่งแจ้งเตือนเข้า 'กลุ่มกู้ภัย' (Rescue Group) 🚨 ✅
    const rescueGroup = await prisma.rescueGroup.findFirst(); // หา Group ID
    
    if (rescueGroup) {
        console.log(`📣 Sending LINE SOS to Group: ${rescueGroup.groupId}`);
        
        await sendCriticalAlertFlexMessage(
            rescueGroup.groupId, // ส่งเข้ากลุ่ม
            {
                latitude: location?.latitude || 0,
                longitude: location?.longitude || 0,
                timestamp: new Date(),
                id: helpRecord.id // ส่ง ID เคสไปด้วย
            },
            caregiverUser, // ข้อมูล User (caregiver)
            caregiver.phone, // เบอร์โทรติดต่อกลับ
            dependent, // ข้อมูลผู้ป่วย
            "SOS", // Alert Type
            `🚨 แจ้งเหตุฉุกเฉินจากญาติ: คุณ ${caregiver.firstName} ขอความช่วยเหลือ!` // ข้อความแจ้งเตือน (Noti Text)
        );
    } else {
        console.warn("⚠️ ไม่พบ Rescue Group ในระบบ (บอทยังไม่ได้ถูกเชิญเข้ากลุ่ม หรือไม่ได้ Join)");
    }
}

async function sendNotRegisteredFlex(replyToken: string) {
  const registerUrl = `${process.env.NEXT_PUBLIC_APP_URL}/register/user`; 
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

// =======================================================
// 🔥 ฟังก์ชันพระเอกที่แก้ใหม่ (handleStatusRequest)
// =======================================================

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
              temperatureRecords: { orderBy: { recordDate: "desc" }, take: 1 },
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

  // 1. ถ้า GPS ปิดอยู่ -> ขึ้นหน้าจอรอ 📡
  if (!dependent.isGpsEnabled) {
    console.log(`📡 GPS OFF: Waking up Dependent: ${dependent.id}`);

    // สั่งเปิด GPS + รอติดตามผล
    await prisma.dependentProfile.update({
      where: { id: dependent.id },
      data: { waitViewLocation: true, isGpsEnabled: true },
    });

    const waitingFlex = createWaitingGpsBubble();
    await client.replyMessage(replyToken, {
        type: 'flex',
        altText: '📡 กำลังค้นหาตำแหน่ง...',
        contents: waitingFlex as any
    });
    return; // จบการทำงาน (ไม่ส่งข้อมูลเก่า)
  }

  // 2. ถ้า GPS เปิดอยู่แล้ว -> โชว์ข้อมูลเลย! (ไม่ว่าจะเก่าหรือใหม่) 🚀
  // แต่แอบ Update Flag ไว้เงียบๆ เผื่อนาฬิกาส่งค่าใหม่มาจะได้ Push ทับ
  await prisma.dependentProfile.update({
      where: { id: dependent.id },
      data: { waitViewLocation: true } 
  });

  const healthData = {
    bpm: latestHr?.bpm || 0,
    temp: latestTemp?.value || 0,
    battery: latestLoc?.battery || 0,
    lat: latestLoc?.latitude || 0,
    lng: latestLoc?.longitude || 0,
    updatedAt: latestLoc?.timestamp || new Date(),
  };

  const flexMessage = createCurrentStatusBubble(dependent, healthData);
  await client.replyMessage(replyToken, {
    type: "flex",
    altText: `สถานะปัจจุบัน: คุณ${dependent.firstName}`,
    contents: flexMessage as any,
  });
}

// ✅ FIX: ฟังก์ชัน Push Status
export async function pushStatusMessage(lineId: string, dependentId: number) {
    const dependent = await prisma.dependentProfile.findUnique({
        where: { id: dependentId },
        include: {
             locations: { orderBy: { timestamp: "desc" }, take: 1 },
             heartRateRecords: { orderBy: { timestamp: "desc" }, take: 1 },
             temperatureRecords: { orderBy: { recordDate: "desc" }, take: 1 },
        }
    });

    if (!dependent) {
        console.warn(`⚠️ ไม่พบ Dependent ID: ${dependentId} สำหรับ Push Message`);
        return;
    }

    const latestLoc = dependent.locations[0];
    const latestHr = dependent.heartRateRecords[0];
    const latestTemp = dependent.temperatureRecords[0];
    const healthData = {
        bpm: latestHr?.bpm || 0,
        temp: latestTemp?.value || 0,
        battery: latestLoc?.battery || 0,
        lat: latestLoc?.latitude || 0,
        lng: latestLoc?.longitude || 0,
        updatedAt: latestLoc?.timestamp || new Date(),
    };

    const flexMessage = createCurrentStatusBubble(dependent, healthData);

    try {
        await client.pushMessage(lineId, {
            type: "flex",
            altText: `สถานะปัจจุบัน: คุณ${dependent.firstName}`,
            contents: flexMessage,
        });
        console.log("✅ ส่งสถานะปัจจุบันสำเร็จ");
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

// ============================================================
// 🎨 ฟังก์ชันสร้าง Flex Message "กำลังค้นหา" (แปะไว้ล่างสุดไฟล์)
// ============================================================
function createWaitingGpsBubble() {
  return {
    "type": "bubble",
    "size": "mega", // ขนาดกำลังดี ไม่ใหญ่เทอะทะ
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
              "text": "📡", // ไอคอนจานดาวเทียม
              "size": "3xl",
              "align": "center"
            }
          ],
          "backgroundColor": "#E8F3FF", // พื้นหลังวงกลมสีฟ้าอ่อน
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
          "color": "#1D4ED8" // สีน้ำเงินเข้ม
        },
        {
          "type": "text",
          "text": "ระบบกำลังสั่งเปิด GPS และค้นหาตำแหน่งล่าสุด กรุณารอสักครู่",
          "wrap": true,
          "color": "#64748B", // สีเทาอ่านง่าย
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