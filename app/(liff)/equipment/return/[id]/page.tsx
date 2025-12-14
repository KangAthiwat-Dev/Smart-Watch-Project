// path: app/(liff)/equipment/return/[id]/page.tsx

import { notFound } from "next/navigation";
import prisma from "@/lib/db/prisma";
// import Component ปุ่มคืนของ หรือ ฟอร์มคืนของ ของนายน้อยมาด้วย

export default async function ReturnDetail({ params }: { params: { id: string } }) {
  const borrowId = parseInt(params.id);
  if (isNaN(borrowId)) return notFound();

  // 1. ดึงข้อมูล
  const borrow = await prisma.borrowEquipment.findUnique({
    where: { id: borrowId },
    include: { items: { include: { equipment: true } } }
  });

  if (!borrow) return notFound();

  const eqName = borrow.items[0]?.equipment.name || "อุปกรณ์";

  // ==========================================
  // 🟢 CASE: APPROVED -> ให้คืนของได้ (เคสปกติ)
  // ==========================================
  if (borrow.status === 'APPROVED') {
      return (
          <div className="p-4">
              <h1 className="text-xl font-bold text-center mb-4">คืนอุปกรณ์</h1>
              <div className="bg-blue-50 p-4 rounded-lg mb-4 text-center">
                  <p className="text-gray-500 text-sm">รายการ</p>
                  <p className="text-xl font-bold text-blue-600">{eqName}</p>
              </div>
              
              {/* ใส่ปุ่มกดคืนของ หรือ Component Form ตรงนี้ */}
              {/* <ReturnButton borrowId={borrowId} /> */}
              <button className="w-full bg-blue-600 text-white p-3 rounded-xl font-bold">
                ยืนยันการคืนอุปกรณ์
              </button>
          </div>
      );
  }

  // ==========================================
  // 🟡 CASE: PENDING -> รออนุมัติ
  // ==========================================
  if (borrow.status === 'PENDING') {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
           <div className="text-5xl mb-4">⏳</div>
           <h2 className="text-xl font-bold text-yellow-600">รอการอนุมัติ</h2>
           <p className="text-gray-500 mt-2">คำขอของนายน้อยกำลังรอเจ้าหน้าที่ตรวจสอบครับ</p>
        </div>
      );
  }

  // ==========================================
  // 🟠 CASE: RETURN_PENDING -> รอตรวจคืน
  // ==========================================
  if (borrow.status === 'RETURN_PENDING') {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
           <div className="text-5xl mb-4">📦</div>
           <h2 className="text-xl font-bold text-orange-600">ได้รับเรื่องคืนแล้ว</h2>
           <p className="text-gray-500 mt-2">กรุณานำอุปกรณ์ไปคืนที่จุดรับคืน<br/>เจ้าหน้าที่จะตรวจสอบความเรียบร้อยครับ</p>
        </div>
      );
  }

  // ==========================================
  // 🏁 CASE: RETURNED -> คืนเสร็จแล้ว
  // ==========================================
  if (borrow.status === 'RETURNED') {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
           <div className="text-5xl mb-4">✅</div>
           <h2 className="text-xl font-bold text-gray-600">รายการนี้คืนสำเร็จแล้ว</h2>
           <p className="text-gray-400 mt-2">ขอบคุณที่ใช้บริการครับ</p>
        </div>
      );
  }

  // ==========================================
  // 🔴 CASE: REJECTED / RETURN_FAILED
  // ==========================================
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
       <div className="text-5xl mb-4">⚠️</div>
       <h2 className="text-xl font-bold text-red-600">
           {borrow.status === 'REJECTED' ? 'คำขอถูกปฏิเสธ' : 'การคืนมีปัญหา'}
       </h2>
       <p className="text-gray-500 mt-2">กรุณาติดต่อเจ้าหน้าที่เพื่อสอบถามข้อมูลเพิ่มเติมครับ</p>
    </div>
  );
}