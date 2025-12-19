import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { sendCriticalAlertFlexMessage } from '@/lib/line/flex-messages';

async function handleFall(request: Request) {
  try {
    const body = await request.json();
    
    const targetId = body.users_id || body.lineId;
    const fallStat = body.fall_status || body.status;
    const x = body.x_axis || body.xAxis || 0;
    const y = body.y_axis || body.yAxis || 0;
    const z = body.z_axis || body.zAxis || 0;
    const { latitude, longitude } = body;

    const user = await prisma.user.findUnique({
      where: { id: parseInt(targetId) },
      include: { 
        dependentProfile: {
            include: { 
                caregiver: { include: { user: true } },
                // ✅ เพิ่ม: ดึง Location ล่าสุดมาด้วย (เผื่อ GPS ใน body เป็น null)
                locations: {
                    take: 1,
                    orderBy: { timestamp: 'desc' }
                }
            }
        }
      }
    });

    if (!user || !user.dependentProfile) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const dependent = user.dependentProfile;
    const caregiver = dependent.caregiver;

    const fallRecord = await prisma.fallRecord.create({
      data: {
        dependentId: dependent.id,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        xAxis: parseFloat(x),
        yAxis: parseFloat(y),
        zAxis: parseFloat(z),
        status: (String(fallStat) === '0') ? 'DETECTED' : 'RESOLVED',
        timestamp: new Date(),
      },
    });

    // *********** FIX ***********
        /*
        เพิ่ม
        isAlertZone1Sent: true,
        isAlertNearZone2Sent: true, 
        isAlertZone2Sent: true,
        notiText สำหรับรายละเอียดการแจ้งเตือนล้ม (เพิ่มใน sendCriticalAlertFlexMessage ด้วย)
        
        fallStat มีค่าได้ 3 แบบ:
        "-1" = ระบบตรวจจับการล้มได้ แต่ผู้ป่วยกดยืนยันว่า "โอเค"
        "0" = ผู้ป่วยกดปุ่ม "ไม่โอเค"
        "1" = ไม่มีการตอบสนองภายใน 30 วินาที
        */
        // *********************************
        let notiText = "";
        if (String(fallStat) === "0" || String(fallStat) === "1") {
            if (String(fallStat) === "0") {
                notiText = `คุณ ${user.dependentProfile.firstName} ${user.dependentProfile.lastName} กด "ไม่โอเค" ขอความช่วยเหลือ`;
            } else {
                notiText = `คุณ ${user.dependentProfile.firstName} ${user.dependentProfile.lastName} ไม่มีการตอบสนองภายใน 30 วินาที`;
            }
            // เปิด GPS
            await prisma.dependentProfile.update({
                where: { id: dependent.id },
                data: {
                    isGpsEnabled: true,
                    isAlertZone1Sent: true, // ถือว่าแจ้งแล้ว จะได้ไม่แจ้งซ้ำ
                    isAlertNearZone2Sent: true, // ถือว่าแจ้งแล้ว
                    isAlertZone2Sent: true, // ถือว่าแจ้งแล้ว
                },
            });

            // ส่ง LINE
            if (caregiver?.user.lineId) {
                await sendCriticalAlertFlexMessage(
                    caregiver.user.lineId,
                    fallRecord,
                    user,
                    caregiver.phone || "",
                    dependent as any,
                    "FALL", // ✅ ระบุ Type ว่าเป็น FALL (จะมีปุ่ม 1669)
                    notiText //<<<<<< เพิ่ม notiText ************************************
                );
            }
        }
        // *********************************

    // ********* Old Code *********
    // if (String(fallStat) === '0') {
    //     // เปิด GPS
    //     await prisma.dependentProfile.update({
    //         where: { id: dependent.id },
    //         data: { isGpsEnabled: true }
    //     });

    //     // ส่ง LINE
    //     if (caregiver?.user.lineId) {
    //          await sendCriticalAlertFlexMessage(
    //             caregiver.user.lineId,
    //             fallRecord,
    //             user,
    //             caregiver.phone || '',
    //             dependent as any,
    //             'FALL' // ✅ ระบุ Type ว่าเป็น FALL (จะมีปุ่ม 1669)
    //         );
    //     }
    // }

    return NextResponse.json({ success: true });
  } catch (e) { 
      console.error(e);
      return NextResponse.json({ error: 'Error' }, { status: 500 }); 
  }
}

export async function POST(req: Request) { return handleFall(req); }
export async function PUT(req: Request) { return handleFall(req); }