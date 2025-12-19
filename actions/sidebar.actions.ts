'use server';

import prisma from '@/lib/db/prisma';
import { cookies } from 'next/headers';

// ==========================================
// 1. ฟังก์ชันดึงตัวเลขแจ้งเตือนทั้งหมด
// ==========================================
export async function getSidebarCounts() {
  const cookieStore = await cookies();

  // ดึงเวลาล่าสุดที่เคยกดเข้าไปดู (ถ้าไม่มีให้เป็นปี 1970 คือนับทั้งหมด)
  const lastViewedCaregivers = cookieStore.get('last_viewed_caregivers')?.value;
  const lastViewedDependents = cookieStore.get('last_viewed_dependents')?.value;

  const caregiverDate = lastViewedCaregivers ? new Date(lastViewedCaregivers) : new Date(0);
  const dependentDate = lastViewedDependents ? new Date(lastViewedDependents) : new Date(0);

  try {
    // ใช้ Promise.all เพื่อดึง 4 ค่าพร้อมกัน (เร็วกว่าดึงทีละอัน)
    const [alerts, transactions, caregivers, dependents] = await Promise.all([
      
      // A. Alerts: นับเฉพาะ SOS ที่สถานะเป็น DETECTED (ยังไม่ได้รับเรื่อง)
      prisma.extendedHelp.count({
        where: { status: 'DETECTED' },
      }),

      // B. Transactions: นับ "รออนุมัติยืม (PENDING)" และ "รอตรวจสอบคืน (RETURN_PENDING)"
      // ถ้าสถานะเป็น Approved, Returned, Rejected จะไม่นับ
      prisma.borrowEquipment.count({
        where: {
          status: { in: ['PENDING', 'RETURN_PENDING'] },
        },
      }),

      // C. Caregivers: นับคนที่สมัครมาใหม่ (Created > Last Viewed)
      prisma.caregiverProfile.count({
        where: {
          createdAt: { gt: caregiverDate },
        },
      }),

      // D. Dependents: นับคนที่สมัครมาใหม่ (Created > Last Viewed)
      prisma.dependentProfile.count({
        where: {
          createdAt: { gt: dependentDate },
        },
      }),
    ]);

    return {
      alerts,
      transactions,
      caregivers,
      dependents,
    };
  } catch (error) {
    console.error('Error fetching sidebar counts:', error);
    return { alerts: 0, transactions: 0, caregivers: 0, dependents: 0 };
  }
}

// ==========================================
// 2. ฟังก์ชันสั่ง "ล้างเลข" (เมื่อกดเข้าไปดู)
// ==========================================
export async function markAsViewed(type: 'caregivers' | 'dependents') {
  const cookieStore = await cookies();
  const now = new Date().toISOString();

  // บันทึกเวลาปัจจุบันลง Cookie ว่า "ฉันดูถึงตรงนี้แล้วนะ"
  // ครั้งหน้าจะนับเฉพาะคนที่มาใหม่กว่าเวลานี้
  cookieStore.set(`last_viewed_${type}`, now);
}