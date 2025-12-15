'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/db/prisma';
import { messagingApi } from "@line/bot-sdk"; 
// ✅ Import ฟังก์ชันสร้าง Flex Message ที่แยกไว้มาใช้ (สวยและดูแลง่าย)
import { createBorrowSuccessBubble, createReturnSuccessBubble } from '@/lib/line/flex-messages';

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
    // 1. เตรียมข้อมูล
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

    // 2. บันทึกลง DB (Transaction)
    await prisma.$transaction(async (tx) => {
      const request = await tx.borrowEquipment.create({
        data: {
          borrowerId: data.caregiverId,
          dependentId: data.dependentId,
          objective: data.objective,
          borrowDate: data.borrowDate,
          status: 'PENDING',
        },
      });

      for (const eqId of data.equipmentIds) {
        await tx.borrowEquipmentItem.create({
          data: {
            borrowId: request.id,
            equipmentId: eqId,
          },
        });
      }
    });

    // 3. ส่ง Flex Message แจ้งเตือนผู้ยืม
    // (แยก Try-Catch เพื่อให้ Database ไม่ Rollback ถ้า LINE Error)
    const lineIdToSend = caregiverUser.lineId;

    if (lineIdToSend) {
        try {
            const { MessagingApiClient } = messagingApi;
            // ใช้ Env ได้ทั้ง 2 แบบ กันพลาด
            const client = new MessagingApiClient({
                channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || process.env.CHANNEL_ACCESS_TOKEN || '',
            });

            // สร้าง Flex Message จากไฟล์ที่แยกไว้
            const flexMsg = createBorrowSuccessBubble(
                `${caregiverUser.caregiverProfile?.firstName} ${caregiverUser.caregiverProfile?.lastName}`,
                dependentProfile ? `${dependentProfile.firstName} ${dependentProfile.lastName}` : "-",
                equipmentNames,
                data.borrowDate
            );
        
            await client.pushMessage({
                to: lineIdToSend,
                messages: [{ type: "flex", altText: "ได้รับคำขอยืมแล้ว", contents: flexMsg as any }]
            });
            
            console.log("✅ ส่ง LINE แจ้งยืมสำเร็จ");
        } catch (lineError) {
            console.error("⚠️ บันทึกสำเร็จ แต่ส่ง LINE ไม่ผ่าน:", lineError);
        }
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
            status: { in: ['APPROVED', 'RETURN_PENDING'] } // เอาเฉพาะที่ยังไม่คืน
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
        // 1. อัปเดตสถานะใน DB และดึงข้อมูลมาด้วยเพื่อส่ง LINE
        const updatedBorrow = await prisma.borrowEquipment.update({
            where: { id: borrowId },
            data: { status: 'RETURN_PENDING' }, // สถานะรอเจ้าหน้าที่ตรวจสอบของจริง
            include: {
                borrower: {
                    include: { user: true } // เพื่อเอา Line ID
                },
                items: {
                    include: { equipment: true } // เพื่อเอาชื่ออุปกรณ์
                }
            }
        });

        // 2. ส่ง Flex Message แจ้งผู้ยืมว่า "ได้รับแจ้งคืนแล้ว"
        const lineId = updatedBorrow.borrower?.user?.lineId;
        // ดึงชื่ออุปกรณ์ตัวแรกมาแสดง (ถ้ามีหลายชิ้นก็โชว์ตัวแรก + ฯลฯ ก็ได้ แต่นี้เอาตัวแรกไปก่อน)
        const equipmentName = updatedBorrow.items.length > 0 
            ? updatedBorrow.items[0].equipment.name 
            : "อุปกรณ์";

        if (lineId) {
            try {
                const { MessagingApiClient } = messagingApi;
                const client = new MessagingApiClient({
                    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || process.env.CHANNEL_ACCESS_TOKEN || '',
                });

                // สร้าง Flex Message ใบรับเรื่องคืน
                const flexMsg = createReturnSuccessBubble(equipmentName, new Date());

                await client.pushMessage({
                    to: lineId,
                    messages: [{ type: "flex", altText: "แจ้งคืนอุปกรณ์เรียบร้อย", contents: flexMsg as any }]
                });
                
                console.log("✅ ส่ง LINE แจ้งคืนสำเร็จ");
            } catch (err) {
                console.error("⚠️ แจ้งคืนสำเร็จ แต่ส่ง LINE ไม่ผ่าน:", err);
            }
        }

        revalidatePath('/admin/borrow-requests');
        return { success: true };
    } catch (error) {
        console.error("Return Request Error:", error);
        return { success: false, error: 'ทำรายการไม่สำเร็จ' };
    }
}

export async function addBulkEquipment(items: { name: string; code: string }[]) {
  try {
    // กรองเอา Code ที่ซ้ำออกก่อน (ถ้าต้องการ) หรือให้ DB จัดการ
    // ในที่นี้ใช้ createMany จะเร็วกว่า loop create ทีละอัน
    
    // หมายเหตุ: createMany ไม่รองรับ SQLite (ถ้า dev ใช้ sqlite ต้อง loop เอา)
    // แต่ถ้าใช้ Postgres/MySQL ใช้ createMany ได้เลย
    
    // ตรวจสอบ Code ซ้ำใน DB ก่อน (Optional)
    const codes = items.map(i => i.code);
    const existing = await prisma.equipment.findMany({
        where: { code: { in: codes } },
        select: { code: true }
    });

    if (existing.length > 0) {
        const existingCodes = existing.map(e => e.code).join(', ');
        return { success: false, error: `รหัสครุภัณฑ์เหล่านี้มีอยู่แล้ว: ${existingCodes}` };
    }

    // บันทึกลง DB
    await prisma.equipment.createMany({
      data: items.map(item => ({
        name: item.name,
        code: item.code,
        isActive: true,
        status: 'AVAILABLE' // หรือค่า default อื่นๆ ตาม schema ของนายน้อย
      })),
      skipDuplicates: true, // ข้ามอันที่ซ้ำ (ถ้า DB รองรับ)
    });
    
    revalidatePath('/admin/equipment'); // เปลี่ยน path ให้ตรงกับหน้าที่นายน้อยใช้งาน
    return { success: true };

  } catch (error) {
    console.error("Bulk create error:", error);
    return { success: false, error: 'เพิ่มข้อมูลไม่สำเร็จ อาจมีรหัสซ้ำ' };
  }
}

export async function getTransactionById(id: number) {
  try {
    const transaction = await prisma.borrowEquipment.findUnique({
      where: { id },
      include: {
        borrower: true, // เอาข้อมูลคนยืม
        dependent: true, // เอาข้อมูลผู้สูงอายุ
        items: {
          include: {
            equipment: true, // เอาชื่ออุปกรณ์
          }
        },
        // ถ้ามีรูปตอนคืนของ (returnImages) ก็ดึงมาด้วย (ถ้า Schema มี)
        // returnImages: true 
      }
    });

    if (!transaction) {
      return { success: false, error: "ไม่พบรายการ" };
    }

    return { success: true, data: transaction };

  } catch (error) {
    console.error(error);
    return { success: false, error: "เกิดข้อผิดพลาดในการดึงข้อมูล" };
  }
}

export async function updateTransactionStatus(transactionId: number, status: string) {
  try {
    // 1. ดึงข้อมูล Transaction เดิมมาก่อน เพื่อดูว่ามีอุปกรณ์อะไรบ้าง
    const transaction = await prisma.borrowEquipment.findUnique({
      where: { id: transactionId },
      include: { items: true }
    });

    if (!transaction) return { success: false, error: "ไม่พบรายการ" };

    // 2. เตรียมข้อมูลอัปเดต
    let updateData: any = { status };
    let equipmentUpdateStatus = ""; // สถานะอุปกรณ์ที่จะเปลี่ยนไป

    // Logic จัดการวันที่และสต็อก
    if (status === 'APPROVED') {
        updateData.borrowApprovedAt = new Date();
        // ถ้าอนุมัติ -> ของต้องไม่ว่าง
        equipmentUpdateStatus = 'UNAVAILABLE'; 
        
        // TODO: ปกติตรงนี้ต้องใส่ ID แอดมินคนอนุมัติด้วย 
        // updateData.borrowApproverId = currentAdminId; 

    } else if (status === 'RETURNED') {
        updateData.returnApprovedAt = new Date();
        // ถ้าคืนสำเร็จ -> ของกลับมาว่าง
        equipmentUpdateStatus = 'AVAILABLE'; 
        
        // updateData.returnApproverId = currentAdminId;
    } else if (status === 'REJECTED') {
        // ถ้าปฏิเสธตอนขอยืม -> ของต้องว่างเหมือนเดิม (เผื่อจองไว้)
        equipmentUpdateStatus = 'AVAILABLE';
    }

    // 3. เริ่ม Transaction (ทำทุกอย่างพร้อมกัน พังก็พังหมด ไม่ข้อมูลแหว่ง)
    await prisma.$transaction(async (tx) => {
        // 3.1 อัปเดตสถานะใบงาน
        await tx.borrowEquipment.update({
            where: { id: transactionId },
            data: updateData
        });

        // 3.2 อัปเดตสถานะอุปกรณ์ (ถ้ามีการเปลี่ยนแปลง)
        if (equipmentUpdateStatus) {
            const equipmentIds = transaction.items.map(i => i.equipmentId);
            
            // อัปเดตทุกชิ้นในใบงานนี้
            await tx.equipment.updateMany({
                where: { id: { in: equipmentIds } },
                data: { 
                    // ตรงนี้ต้องดู Schema นายน้อยว่าใช้ field ไหนเก็บสถานะอุปกรณ์ 
                    // (เช่น isActive หรือ status='AVAILABLE'/'BORROWED')
                    // สมมติว่านายน้อยใช้ isActive (true=ว่าง, false=ไม่ว่าง/เสีย)
                    // หรือถ้ามี field status ก็แก้ตรงนี้ได้เลยครับ
                    // ตัวอย่าง:
                    isActive: equipmentUpdateStatus === 'AVAILABLE' 
                }
            });
        }
    });

    revalidatePath('/admin/transactions');
    return { success: true };

  } catch (error) {
    console.error("Update Status Error:", error);
    return { success: false, error: "เกิดข้อผิดพลาดในการอัปเดต" };
  }
}