import { NextRequest, NextResponse } from 'next/server';
import { registerUser } from '@/services/auth.service';
import { registerSchema } from '@/lib/validations/auth.schema';
import { sendLineNotification } from '@/lib/line/client';
import prisma from '@/lib/db/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validated = registerSchema.parse(body);

    const user = await registerUser(validated);

    const firstName = user.caregiverProfile?.firstName ?? "";
    const lastName = user.caregiverProfile?.lastName ?? "";

    if (user.lineId) {
      await sendLineNotification(
        user.lineId,
        `ลงทะเบียนสำเร็จ\n\nยินดีต้อนรับคุณ ${firstName} ${lastName}\n\nคุณสามารถเริ่มใช้งานระบบได้แล้ว`
      );
    }

    // Create Notification
    await prisma.notification.create({
      data: {
        type: "REGISTER",
        title: "ผู้ใช้ใหม่ลงทะเบียน",
        message: `ลงทะเบียนใหม่: ${firstName} ${lastName} (ผู้ดูแล)`,
        link: "/admin/dashboard?tab=users"
      }
    });

    return NextResponse.json(
      { message: "User registered successfully", userId: user.id },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด',
      },
      { status: 400 }
    );
  }
}
