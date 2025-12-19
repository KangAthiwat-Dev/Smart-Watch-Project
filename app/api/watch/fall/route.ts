import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { sendCriticalAlertFlexMessage } from '@/lib/line/flex-messages';

async function handleFall(request: Request) {
  try {
    const body = await request.json();
    
    // รับค่าต่างๆ
    const targetId = body.users_id || body.lineId;
    const fallStat = String(body.fall_status || body.status);
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
                // ไม่ต้องดึง locations มาเช็คโซน (แยกกันทำงาน)
            }
        }
      }
    });

    if (!user || !user.dependentProfile) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const dependent = user.dependentProfile;
    const caregiver = dependent.caregiver;

    // Logic Status
    const isCritical = fallStat === "0" || fallStat === "1";
    const dbStatus = isCritical ? 'DETECTED' : 'RESOLVED';

    // 1. บันทึกการล้ม
    const fallRecord = await prisma.fallRecord.create({
      data: {
        dependentId: dependent.id,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        xAxis: parseFloat(String(x)),
        yAxis: parseFloat(String(y)),
        zAxis: parseFloat(String(z)),
        status: dbStatus,
        timestamp: new Date(),
      },
    });

    // 2. แจ้งเตือน LINE (แยกประเภทชัดเจน)
    if (isCritical && caregiver?.user.lineId) {
        let notiText = "";
        let specificAlertType = "FALL"; // Default

        if (fallStat === "0") {
            // กดปุ่ม SOS เอง = รู้สึกตัว
            specificAlertType = "FALL_SOS"; 
            notiText = `แจ้งเตือน: คุณ ${dependent.firstName} ล้มและกดปุ่มขอความช่วยเหลือ (รู้สึกตัว)`;
        } else {
            // หมดเวลา 30 วิ = ไม่ตอบสนอง
            specificAlertType = "FALL_UNCONSCIOUS";
            notiText = `ด่วน!: คุณ ${dependent.firstName} ล้มและไม่มีการตอบสนอง (อาจหมดสติ)`;
        }

        await sendCriticalAlertFlexMessage(
            caregiver.user.lineId,
            fallRecord,
            user,
            caregiver.phone || "",
            dependent as any,
            specificAlertType as any, // ส่ง Type ใหม่ไป
            notiText
        );
    }

    return NextResponse.json({ success: true });
  } catch (e) { 
      console.error(e);
      return NextResponse.json({ error: 'Error' }, { status: 500 }); 
  }
}

export async function POST(req: Request) { return handleFall(req); }
export async function PUT(req: Request) { return handleFall(req); }