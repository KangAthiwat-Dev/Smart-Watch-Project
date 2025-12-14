import { notFound } from "next/navigation";
import prisma from "@/lib/db/prisma"; // หรือ path ที่นายน้อยเก็บ prisma

export default async function ReturnEquipmentPage({ params }: { params: { id: string } }) {
  const borrowId = parseInt(params.id);
  if (isNaN(borrowId)) return notFound();

  // 1. ดึงข้อมูล
  const borrow = await prisma.borrowEquipment.findUnique({
    where: { id: borrowId },
    include: { items: { include: { equipment: true } } }
  });

  if (!borrow) return notFound(); // ถ้าหาไม่เจอจริงๆ ค่อย 404

  // 2. 🟡 กรณี: รอการอนุมัติ (PENDING) -> โชว์หน้าแจ้งเตือน
  if (borrow.status === 'PENDING') {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center text-4xl mb-4">
          ⏳
        </div>
        <h1 className="text-xl font-bold text-yellow-700">รายการนี้รอการอนุมัติ</h1>
        <p className="text-gray-500 mt-2">เจ้าหน้าที่กำลังตรวจสอบคำขอของคุณ<br/>กรุณารอการแจ้งเตือนเมื่อได้รับการอนุมัติครับ</p>
        <div className="mt-6 p-4 bg-gray-50 rounded-lg w-full max-w-sm">
            <p className="text-sm text-gray-400">อุปกรณ์:</p>
            <p className="font-bold text-gray-700">{borrow.items[0]?.equipment.name}</p>
        </div>
      </div>
    );
  }

  // 3. 🔴 กรณี: ไม่อนุมัติ (REJECTED) -> โชว์หน้าแจ้งเตือน
  if (borrow.status === 'REJECTED') {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-4xl mb-4">
          ❌
        </div>
        <h1 className="text-xl font-bold text-red-700">คำขอถูกปฏิเสธ</h1>
        <p className="text-gray-500 mt-2">รายการนี้ไม่ได้รับการอนุมัติ</p>
      </div>
    );
  }

  // 4. 🟢 กรณี: อนุมัติแล้ว (APPROVED) -> โชว์ฟอร์มคืนของตามปกติ
  if (borrow.status === 'APPROVED') {
     // ... (ใส่ Component ฟอร์มคืนของเดิมของนายน้อยตรงนี้) ...
     return (
        // <ReturnForm borrow={borrow} /> หรือ HTML เดิมที่มี
        <div className="p-4">
            <h1 className="text-lg font-bold mb-4">คืนอุปกรณ์: {borrow.items[0]?.equipment.name}</h1>
            {/* ... ปุ่มกดยืนยันคืน ... */}
        </div>
     )
  }

  // กรณีอื่นๆ (เช่น คืนไปแล้ว)
  return (
    <div className="p-6 text-center text-gray-500">
        รายการนี้เสร็จสิ้นไปแล้วครับ
    </div>
  );
}