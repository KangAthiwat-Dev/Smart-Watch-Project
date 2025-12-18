import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma'; // เช็ค path import ให้ตรงกับโปรเจกต์นะครับ
import { createRescueGroupFlexMessage, createRescueSuccessBubble } from '@/lib/line/flex-messages';
import { Client } from '@line/bot-sdk';
import { AlertStatus, HelpType, UserRole } from '@prisma/client'; 

const lineClient = new Client({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
    channelSecret: process.env.LINE_CHANNEL_SECRET || '',
});

export async function POST(request: Request) {
    try {
        const body = await request.json();
        // ✅ 1. รับค่า recordId และ alertType เพิ่ม
        const { userId, latitude: clientLat, longitude: clientLng, message, recordId, alertType } = body; 

        console.log("🔍 SOS Request:", { userId, alertType, recordId });

        if (!userId) return NextResponse.json({ error: "User ID missing" }, { status: 400 });

        // 2. หา User
        const user = await prisma.user.findUnique({
            where: { lineId: userId }, 
        });

        if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

        let dependentId: number | null = null;
        let reporterId: number | null = null;
        let dependentInfo = null;
        let caregiverInfo = null;

        // --- Step 1: ระบุตัวตน (ใครเป็นคนกดแจ้ง) ---
        if (user.role === UserRole.DEPENDENT) {
            const depProfile = await prisma.dependentProfile.findUnique({
                where: { userId: user.id },
                include: { caregiver: { include: { user: true } }, user: true }
            });
            if (!depProfile || !depProfile.caregiverId) return NextResponse.json({ error: "Profile/Caregiver Error" }, { status: 400 });

            dependentId = depProfile.id;
            reporterId = depProfile.caregiverId; 
            dependentInfo = depProfile;
            caregiverInfo = depProfile.caregiver;

        } else if (user.role === UserRole.CAREGIVER || user.role === UserRole.ADMIN) {
             const cgProfile = await prisma.caregiverProfile.findUnique({
                where: { userId: user.id },
                include: { dependents: { include: { user: true } }, user: true }
             });
             if (!cgProfile || cgProfile.dependents.length === 0) return NextResponse.json({ error: "No dependents found" }, { status: 400 });

             // สมมติว่า Caregiver ดูแลคนเดียว หรือเลือกคนแรก (Logic เดิมนายน้อย)
             const targetDependent = cgProfile.dependents[0]; 
             dependentId = targetDependent.id;
             reporterId = cgProfile.id; 
             dependentInfo = { ...targetDependent, caregiver: cgProfile };
             caregiverInfo = cgProfile;
        } else {
             return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        // --- Step 2: 🟢 หาพิกัดล่าสุด (ถ้า Client ไม่ส่งมา ให้เอาจาก DB ล่าสุด) ---
        let finalLat = clientLat;
        let finalLng = clientLng;

        if (dependentId && (!finalLat || !finalLng)) {
            const lastLocation = await prisma.location.findFirst({
                where: { dependentId: dependentId },
                orderBy: { timestamp: 'desc' } 
            });

            if (lastLocation) {
                finalLat = lastLocation.latitude;
                finalLng = lastLocation.longitude;
            }
        }

        // --- Step 3: 📝 สร้างข้อความรายละเอียด (Details) ---
        // เอาประเภทแจ้งเตือนและ ID เหตุการณ์ไปแปะไว้ใน details
        let detailsText = message || "ขอความช่วยเหลือ";
        if (alertType) detailsText = `[${alertType}] ${detailsText}`;
        if (recordId) detailsText += ` (Ref ID: ${recordId})`;

        // --- Step 4: สร้าง Alert ลงตาราง ExtendedHelp ---
        const newAlert = await prisma.extendedHelp.create({
            data: {
                status: AlertStatus.DETECTED,
                type: HelpType.LINE_SOS,      
                dependentId: dependentId!,
                reporterId: reporterId!,          
                latitude: finalLat || null,   
                longitude: finalLng || null,
                details: detailsText // ✅ บันทึกรายละเอียดลงไป
            },
            include: {
                dependent: { include: { user: true } },
                reporter: { include: { user: true } }
            }
        });

        // --- Step 5: 🔄 อัปเดตสถานะ Record ต้นทาง (ถ้ามี) ---
        // เช่น ถ้าแจ้งว่า "ล้ม" ให้ไปอัปเดตตาราง FallRecord ว่า "รับทราบแล้ว" (ACKNOWLEDGED)
        if (recordId && alertType === 'FALL') {
            try {
                await prisma.fallRecord.update({
                    where: { id: parseInt(recordId) },
                    data: { status: 'ACKNOWLEDGED' }
                });
                console.log(`✅ Updated FallRecord #${recordId} to ACKNOWLEDGED`);
            } catch (err) {
                console.warn("⚠️ Could not update FallRecord:", err);
            }
        }

        // --- Step 6: ส่ง LINE เข้ากลุ่มกู้ภัย ---
        const rescueGroup = await prisma.rescueGroup.findFirst({
            orderBy: { createdAt: 'desc' }
        });
        
        const targetGroupId = rescueGroup?.groupId;

        if (targetGroupId && dependentInfo) {
            // ปรับหัวข้อตามประเภทแจ้งเตือน
            let alertTitle = message || "🆘 ขอความช่วยเหลือด่วน";
            if (alertType === 'FALL') alertTitle = "🚨 ยืนยันเหตุการล้ม";
            else if (alertType === 'HEALTH') alertTitle = "🚨 สัญญาณชีพผิดปกติ";
            else if (alertType === 'ZONE') alertTitle = "🚨 แจ้งเตือนออกนอกพื้นที่";
            
            const flexMsg = createRescueGroupFlexMessage(
                newAlert.id,
                newAlert, 
                dependentInfo.user,
                caregiverInfo!, 
                dependentInfo,
                alertTitle
            );

            await lineClient.pushMessage(targetGroupId, {
                type: 'flex',
                altText: `🚨 ${alertTitle}: ${dependentInfo.user.username}`,
                contents: flexMsg as any 
            });
            console.log(`✅ ส่งแจ้งเตือนไปยังกลุ่ม ${targetGroupId} สำเร็จ`);
        }

        // --- Step 7: แจ้งกลับไปหา "คนกด" (ผู้ดูแล) ---
        const successBubble = createRescueSuccessBubble(); 
        
        await lineClient.pushMessage(userId, {
            type: 'flex',
            altText: '✅ แจ้งเหตุสำเร็จ! เจ้าหน้าที่กำลังตรวจสอบ',
            contents: successBubble
        });

        return NextResponse.json({ success: true, alertId: newAlert.id });

    } catch (e) {
        console.error("❌ ERROR:", e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}