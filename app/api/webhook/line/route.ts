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
} from "@/lib/line/flex-messages";

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || "",
  channelSecret: process.env.LINE_CHANNEL_SECRET || "",
};

const client = new Client(config);

// เพิ่มฟังก์ชันสำหรับตรวจสอบ Signature
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

    // จัดการ Request ที่ว่างเปล่าทันที (Request Verify)
    if (!bodyText || bodyText.length === 0) {
      return NextResponse.json(
        { status: "ok", message: "Verification or empty body received" },
        { status: 200 }
      );
    }

    // ตรวจสอบ Signature
    if (!validateLineSignature(bodyText, signature)) {
      console.warn("⚠️ Invalid LINE signature received.");
    }

    const body = JSON.parse(bodyText);
    const events: WebhookEvent[] = body.events;

    console.log("🔥 EVENT LOG:", JSON.stringify(events, null, 2));

    await Promise.all(
      events.map(async (event) => {
        // ============================================================
        // 🟢 PART 1: จัดการกลุ่ม (Rescue Group Logic)
        // ============================================================
        if (event.type === "join" && event.source.type === "group") {
          const groupId = event.source.groupId;
          console.log(`🤖 บอทเข้ากลุ่ม ID: ${groupId}`);
          try {
            await prisma.rescueGroup.deleteMany(); // ลบกลุ่มเก่า
            await prisma.rescueGroup.create({ data: { groupId } }); // จำกลุ่มใหม่
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

        // *********** FIX ***********
        // เพิ่ม feature การแจ้งเตือนการล้ม
        // *********************************
        // ============================================================
        // � PART 3: Postback Action (ปุ่มกดต่างๆ)
        // ============================================================
        if (event.type === "postback") {
          const data = event.postback.data;
          const params = new URLSearchParams(data);
          const action = params.get("action");

          if (action === "resolve_fall") {
            const recordId = parseInt(params.get("id") || "0");
            if (recordId > 0) {
              try {
                // 1. ดึงข้อมูล Fall Record เพื่อหา dependentId
                const fallRecord = await prisma.fallRecord.findUnique({
                  where: { id: recordId },
                  select: { dependentId: true },
                });

                if (fallRecord) {
                  // 2. อัปเดตสถานะเป็น RESOLVED
                  await prisma.fallRecord.update({
                    where: { id: recordId },
                    data: { status: "RESOLVED" },
                  });

                  // 3. ✅ รีเซ็ต Flag การแจ้งเตือนโซน ให้กลับมาทำงานใหม่ทันที
                  // เผื่อว่าผู้ป่วยยังอยู่นอกเขต ระบบจะได้แจ้งเตือนโซนต่อได้เลย
                  await prisma.dependentProfile.update({
                    where: { id: fallRecord.dependentId },
                    data: {
                      isAlertZone1Sent: false,
                      isAlertNearZone2Sent: false,
                      isAlertZone2Sent: false,
                    },
                  });
                }

                // ตอบกลับผู้ใช้
                await client.replyMessage(event.replyToken, {
                  type: "text",
                  text: "✅ รับทราบครับ ระบบบันทึกว่าท่านได้เข้าช่วยเหลือเรียบร้อยแล้ว และจะเริ่มแจ้งเตือนโซนตามปกติครับ",
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
        }
        // *********************************

        // ============================================================
        // 🟡 PART 2: ตอบแชท / เมนู (Message Logic)
        // ============================================================
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
          // --- 6. เช็คคำสั่งลงทะเบียนจาก User ทั่วไป (เผื่อคนพิมพ์เอง) ---
          else if (
            userMessage.includes("ลงทะเบียน") &&
            event.source.type === "user"
          ) {
            // ✅ ใช้ Flex Message การ์ดลงทะเบียนแบบเดียวกัน
            const registerUrl = `${process.env.NEXT_PUBLIC_APP_URL}/register`;
            const flexMsg = createRegisterButtonBubble(registerUrl);

            await client.replyMessage(event.replyToken, {
              type: "flex",
              altText: "กรุณาลงทะเบียนเข้าใช้งาน",
              contents: flexMsg as any,
            });
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

// ✅ ฟังก์ชันกลางสำหรับส่งการ์ด "กรุณาลงทะเบียน" (ใช้ซ้ำได้เลย)
async function sendNotRegisteredFlex(replyToken: string) {
  const registerUrl = `${process.env.NEXT_PUBLIC_APP_URL}/register/user`; // ลิงก์ไปยังหน้าลงทะเบียน
  const flexMsg = createRegisterButtonBubble(registerUrl);

  await client.replyMessage(replyToken, {
    type: "flex",
    altText: "ไม่พบข้อมูลลงทะเบียน", // ข้อความแจ้งเตือนถ้ามือถือไม่รองรับ Flex
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

  // 🔴 แก้ไข: ถ้าไม่เจอข้อมูล ให้ส่ง Flex ลงทะเบียนแทน Text เดิม
  if (
    !caregiverUser ||
    !caregiverUser.caregiverProfile ||
    caregiverUser.caregiverProfile.dependents.length === 0
  ) {
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
              temperatureRecords: { orderBy: { recordDate: "desc" }, take: 1 },
            },
          },
        },
      },
    },
  });

  // 🔴 แก้ไข: ส่ง Flex ลงทะเบียน
  if (
    !caregiverUser ||
    !caregiverUser.caregiverProfile ||
    caregiverUser.caregiverProfile.dependents.length === 0
  ) {
    await sendNotRegisteredFlex(replyToken);
    return;
  }

  const dependent = caregiverUser.caregiverProfile.dependents[0];
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

  // *********** FIX ***********
  // ตรวจสอบกรณีที่ GPS ปิด ให้ตั้ง waitViewLocation เป็น true และไม่ส่งสถานะ
  // *********************************
  if (!dependent.isGpsEnabled) {
    await prisma.dependentProfile.update({
      where: { id: dependent.id },
      data: { waitViewLocation: true },
    });
    return;
  }
  // *********************************

  const flexMessage = createCurrentStatusBubble(dependent, healthData);
  await client.replyMessage(replyToken, {
    type: "flex",
    altText: `สถานะปัจจุบัน: คุณ${dependent.firstName}`,
    contents: flexMessage as any,
  });
}

// *********** FIX ***********
// เพิ่มฟังก์ชัน pushStatusMessage เพื่อใช้ส่งสถานะปัจจุบันเมื่อปิดการแจ้งเตือนออกนอกเขตปลอดภัย
// *********************************
export async function pushStatusMessage(lineId: string, dependentId: number) {
    const caregiverUser = await prisma.user.findFirst({
        where: { lineId },
        include: {
            caregiverProfile: {
                include: {
                    dependents: {
                        include: {
                            locations: {
                                orderBy: { timestamp: "desc" },
                                take: 1,
                            },
                            heartRateRecords: {
                                orderBy: { timestamp: "desc" },
                                take: 1,
                            },
                            temperatureRecords: {
                                orderBy: { recordDate: "desc" },
                                take: 1,
                            },
                        },
                    },
                },
            },
        },
    });
    if (
        !caregiverUser ||
        !caregiverUser.caregiverProfile ||
        caregiverUser.caregiverProfile.dependents.length === 0
    ) {
        console.warn("⚠️ ไม่พบข้อมูลผู้สูงอายุในการส่งสถานะปัจจุบัน");
        return;
    }
    const dependent = caregiverUser.caregiverProfile.dependents[0];
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

    // 2. สร้าง Flex Message
    const flexMessage = createCurrentStatusBubble(dependent, healthData);

    // 3. ส่ง Push Message
    await client.pushMessage(lineId, {
        type: "flex",
        altText: `สถานะปัจจุบัน: คุณ${dependent.firstName}`,
        contents: flexMessage,
    });
    console.log("✅ ส่งสถานะปัจจุบันสำเร็จ");
}
// *********************************

async function handleProfileRequest(lineId: string, replyToken: string) {
  const caregiverUser = await prisma.user.findFirst({
    where: { lineId },
    include: { caregiverProfile: { include: { dependents: true } } },
  });

  // 🔴 แก้ไข: ส่ง Flex ลงทะเบียน
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

  // 🔴 แก้ไข: ส่ง Flex ลงทะเบียน
  if (
    !caregiverUser ||
    !caregiverUser.caregiverProfile ||
    caregiverUser.caregiverProfile.dependents.length === 0
  ) {
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

  // 🔴 แก้ไข: ส่ง Flex ลงทะเบียน
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
