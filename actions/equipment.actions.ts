'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/db/prisma';
import { messagingApi } from "@line/bot-sdk"; 

// =================================================================
// 🔧 ส่วนจัดการอุปกรณ์ (Admin CRUD)
// =================================================================

export async function getEquipments() {
  try {
    const equipments = await prisma.equipment.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        borrowItems: {
            where: {
                borrow: {
                    status: { in: ['PENDING', 'APPROVED'] }
                }
            },
            include: { borrow: true }
        }
      }
    });
    return { success: true, data: equipments };
  } catch (error) {
    return { success: false, error: 'ดึงข้อมูลไม่สำเร็จ' };
  }
}

export async function addEquipment(data: { name: string; code: string }) {
  try {
    const existing = await prisma.equipment.findUnique({ where: { code: data.code } });
    if (existing) return { success: false, error: 'รหัสครุภัณฑ์นี้มีอยู่แล้ว' };

    await prisma.equipment.create({
      data: {
        name: data.name,
        code: data.code,
        isActive: true,
        status: 'AVAILABLE' 
      }
    });
    
    revalidatePath('/admin/equipment');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'เพิ่มข้อมูลไม่สำเร็จ' };
  }
}

export async function updateEquipment(id: number, data: { name: string; code: string; isActive: boolean }) {
  try {
    await prisma.equipment.update({
      where: { id },
      data: {
        name: data.name,
        code: data.code,
        isActive: data.isActive
      }
    });
    
    revalidatePath('/admin/equipment');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'แก้ไขไม่สำเร็จ' };
  }
}

export async function deleteEquipment(id: number) {
  try {
    await prisma.equipment.delete({ where: { id } });
    revalidatePath('/admin/equipment');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'ไม่สามารถลบได้' };
  }
}

// =================================================================
// 📦 ส่วนระบบยืม (Borrowing System)
// =================================================================

export async function getAvailableEquipments() {
  try {
    const equipments = await prisma.equipment.findMany({
      where: { 
        status: 'AVAILABLE',
        isActive: true       
      },
      orderBy: { name: 'asc' },
    });
    return { success: true, data: equipments };
  } catch (error) {
    return { success: false, error: 'ดึงข้อมูลอุปกรณ์ไม่สำเร็จ' };
  }
}

export async function createBorrowRequest(data: {
  caregiverId: number;
  dependentId: number;
  objective: string;
  borrowDate: Date;
  equipmentIds: number[];
}) {
  try {
    // 6.1 เตรียมข้อมูลผู้ยืม
    const caregiverUser = await prisma.user.findFirst({
        where: { caregiverProfile: { id: data.caregiverId } },
        include: { caregiverProfile: true }
    });
    
    const dependentProfile = await prisma.dependentProfile.findUnique({
        where: { id: data.dependentId }
    });

    const equipments = await prisma.equipment.findMany({
        where: { id: { in: data.equipmentIds } }
    });
    const equipmentNames = equipments.map(e => e.name).join(", ");

    if (!caregiverUser) return { success: false, error: 'ไม่พบข้อมูลผู้ยืม' };

    // 6.2 บันทึกลง DB (ใช้ชื่อ Model ตาม Schema นายน้อย)
    await prisma.$transaction(async (tx) => {
      // ✅ แก้จาก tx.borrowRequest -> tx.borrowEquipment
      const request = await tx.borrowEquipment.create({
        data: {
          borrowerId: data.caregiverId, // ✅ map caregiverId เข้า borrowerId
          dependentId: data.dependentId,
          objective: data.objective,
          borrowDate: data.borrowDate,
          status: 'PENDING',
        },
      });

      for (const eqId of data.equipmentIds) {
        // ✅ แก้จาก tx.borrowRequestItem -> tx.borrowEquipmentItem
        await tx.borrowEquipmentItem.create({
          data: {
            borrowId: request.id, // ✅ map request.id เข้า borrowId
            equipmentId: eqId,
          },
        });
      }
    });

    // 6.3 ส่ง Flex Message
    const { MessagingApiClient } = messagingApi;
    const client = new MessagingApiClient({
        channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || '',
    });

    // ✅ เช็ค lineId ให้ชัวร์ว่าเป็น string ไม่ใช่ null
    const lineIdToSend = caregiverUser.lineId || '';

    if (lineIdToSend) {
        const flexMsg: any = {
            type: "flex",
            altText: "ได้รับคำขอยืมอุปกรณ์แล้ว",
            contents: {
              type: "bubble",
              body: {
                type: "box",
                layout: "vertical",
                contents: [
                  { type: "text", text: "ได้รับคำขอยืมแล้ว", weight: "bold", color: "#1DB446", size: "sm" },
                  { type: "text", text: "ยืมอุปกรณ์ครุภัณฑ์", weight: "bold", size: "xl", margin: "md" },
                  { type: "text", text: "กรุณารอเจ้าหน้าที่ตรวจสอบและอนุมัติ", size: "xs", color: "#aaaaaa", wrap: true },
                  { type: "separator", margin: "xxl" },
                  {
                    type: "box", layout: "vertical", margin: "xxl", spacing: "sm",
                    contents: [
                      {
                        type: "box", layout: "baseline",
                        contents: [
                          { type: "text", text: "ผู้ยืม", color: "#aaaaaa", size: "sm", flex: 2 },
                          { type: "text", text: `${caregiverUser.caregiverProfile?.firstName} ${caregiverUser.caregiverProfile?.lastName}`, wrap: true, color: "#666666", size: "sm", flex: 4 }
                        ]
                      },
                      {
                        type: "box", layout: "baseline",
                        contents: [
                          { type: "text", text: "ผู้สูงอายุ", color: "#aaaaaa", size: "sm", flex: 2 },
                          { type: "text", text: `${dependentProfile?.firstName} ${dependentProfile?.lastName}`, wrap: true, color: "#666666", size: "sm", flex: 4 }
                        ]
                      },
                      {
                        type: "box", layout: "baseline",
                        contents: [
                          { type: "text", text: "อุปกรณ์", color: "#aaaaaa", size: "sm", flex: 2 },
                          { type: "text", text: equipmentNames, wrap: true, color: "#666666", size: "sm", flex: 4 }
                        ]
                      },
                      {
                          type: "box", layout: "baseline",
                          contents: [
                            { type: "text", text: "วันที่ยืม", color: "#aaaaaa", size: "sm", flex: 2 },
                            { type: "text", text: new Date(data.borrowDate).toLocaleDateString('th-TH'), wrap: true, color: "#666666", size: "sm", flex: 4 }
                          ]
                        }
                    ]
                  }
                ]
              }
            }
          };
      
          await client.pushMessage({
              to: lineIdToSend, // ✅ หายแดงแล้ว
              messages: [flexMsg]
          });
    }

    revalidatePath('/admin/borrow-requests');
    return { success: true };

  } catch (error) {
    console.error('Create Borrow Error:', error);
    return { success: false, error: 'บันทึกคำขอไม่สำเร็จ' };
  }
}

// =================================================================
// ↩️ ส่วนระบบคืน (Return System)
// =================================================================

// 7. ดึงรายการที่ฉันยืมอยู่ (Status = APPROVED หรือ RETURN_PENDING)
export async function getMyBorrowedEquipments(lineId: string) {
  try {
    const user = await prisma.user.findFirst({
        where: { lineId: lineId },
        include: { caregiverProfile: true }
    });

    if (!user || !user.caregiverProfile) return { success: false, error: 'ไม่พบผู้ใช้' };

    const borrows = await prisma.borrowEquipment.findMany({
        where: {
            borrowerId: user.caregiverProfile.id,
            status: { in: ['APPROVED', 'RETURN_PENDING'] } // ✅ เอาเฉพาะที่ยังไม่คืน
        },
        include: {
            dependent: true, // เอาชื่อผู้สูงอายุมาโชว์
            items: {
                include: { equipment: true } // เอาชื่ออุปกรณ์มาโชว์
            }
        },
        orderBy: { borrowDate: 'desc' }
    });

    return { success: true, data: borrows };

  } catch (error) {
    console.error(error);
    return { success: false, error: 'ดึงข้อมูลไม่สำเร็จ' };
  }
}

// 8. แจ้งคืนอุปกรณ์ (เปลี่ยนสถานะเป็น RETURN_PENDING)
export async function createReturnRequest(borrowId: number) {
    try {
        await prisma.borrowEquipment.update({
            where: { id: borrowId },
            data: { status: 'RETURN_PENDING' } // 🟡 รอเจ้าหน้าที่ตรวจสอบของจริง
        });

        // (Optional) อาจจะส่ง Flex Message แจ้ง Admin ว่ามีการแจ้งคืน

        revalidatePath('/admin/borrow-requests');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'ทำรายการไม่สำเร็จ' };
    }
}