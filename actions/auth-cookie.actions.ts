'use server';

import { prisma } from "@/lib/db/prisma";
import { cookies } from "next/headers";

export async function setAuthCookie(lineUserId: string) {
  try {
    // หา User จาก Line ID
    const user = await prisma.user.findUnique({
      where: { lineId: lineUserId },
      select: { id: true } // เอาแค่ ID (Int)
    });

    if (user) {
      // ฝัง Cookie ชื่อ 'userId' เก็บค่า ID ที่เป็นตัวเลข (Int)
      (await cookies()).set('userId', user.id.toString(), {
        path: '/',
        maxAge: 86400, // 1 วัน
        httpOnly: true, // ปลอดภัยกว่า
        secure: process.env.NODE_ENV === 'production',
      });
      return true;
    }
    return false;
  } catch (error) {
    console.error("Set Cookie Error:", error);
    return false;
  }
}