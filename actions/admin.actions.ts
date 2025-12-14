'use server';

import prisma from '@/lib/db/prisma';
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';

export async function updateAdminProfile(userId: number, formData: any) {
  try {
    const { firstName, lastName, phone, position, username, password, newPassword } = formData;

    // 1. ตรวจสอบ User มีอยู่จริงไหม
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { success: false, error: 'User not found' };

    // 2. ถ้ามีการเปลี่ยนรหัสผ่าน
    let passwordHash = undefined;
    if (newPassword && newPassword.trim() !== '') {
        // เช็คความถูกต้อง (Optional: เช็ครหัสเดิมก่อนก็ได้)
        const salt = await bcrypt.genSalt(10);
        passwordHash = await bcrypt.hash(newPassword, salt);
    }

    // 3. อัปเดตข้อมูล (ทำ Transaction เพื่อความชัวร์)
    await prisma.$transaction([
        // อัปเดต User (Username, Password)
        prisma.user.update({
            where: { id: userId },
            data: {
                username: username,
                ...(passwordHash && { password: passwordHash }), // อัปเดตเฉพาะถ้ามีค่าใหม่
            }
        }),
        // อัปเดต Profile
        prisma.adminProfile.update({
            where: { userId: userId },
            data: {
                firstName,
                lastName,
                phone,
                position,
                // image: ... (ส่วนรูปภาพ ถ้ามีการอัปโหลดต้องจัดการ URL มาก่อนส่งเข้า Action)
            }
        })
    ]);

    revalidatePath('/admin'); // รีเฟรชข้อมูล
    return { success: true };

  } catch (error) {
    console.error("Update Profile Error:", error);
    return { success: false, error: 'อัปเดตข้อมูลไม่สำเร็จ (Username อาจซ้ำ)' };
  }
}

// ดึงข้อมูล Admin ล่าสุด
export async function getAdminProfile(userId: number) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { adminProfile: true }
    });
    
    if (!user || !user.adminProfile) return null;

    return {
        username: user.username,
        firstName: user.adminProfile.firstName,
        lastName: user.adminProfile.lastName,
        phone: user.adminProfile.phone,
        position: user.adminProfile.position,
        image: user.adminProfile.image
    };
}