'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, Package, CheckCircle2, XCircle, Edit, AlertTriangle, Loader2 } from 'lucide-react';
import { EquipmentDialog } from './equipment-dialog';
import { deleteEquipment } from '@/actions/equipment.actions';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function EquipmentTable({ data }: { data: any[] }) {
  const [targetDelete, setTargetDelete] = useState<{ id: number, name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
      if (!targetDelete) return;
      setIsDeleting(true);
      
      try {
        const res = await deleteEquipment(targetDelete.id);
        if(res.success) {
            toast.success("ลบอุปกรณ์เรียบร้อย");
            setTargetDelete(null);
        } else {
            toast.error(res.error);
        }
      } catch (error) {
        toast.error("เกิดข้อผิดพลาด");
      } finally {
        setIsDeleting(false);
      }
  };

  if (data.length === 0) {
      return (
          <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-3">
              <div className="p-4 bg-white rounded-full shadow-sm">
                <Package className="w-10 h-10 text-gray-300" />
              </div>
              <div>
                <p className="text-gray-600 font-medium">ยังไม่มีอุปกรณ์ในระบบ</p>
                <p className="text-gray-400 text-xs">กดปุ่มเพิ่มด้านบนเพื่อเริ่มใช้งาน</p>
              </div>
          </div>
      )
  }

  return (
    <>
      <div className="relative overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] rounded-xl border border-gray-200 shadow-sm scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
        <table className="w-full text-sm text-left">
          
          {/* ✅ Sticky Header: หัวตารางจะลอยค้างไว้ตอนเลื่อนลง */}
          <thead className="sticky top-0 z-10 bg-gray-50 text-gray-500 font-medium border-b border-gray-200 shadow-sm">
            <tr>
              <th className="px-6 py-3 w-[150px]">รหัสครุภัณฑ์</th>
              <th className="px-6 py-3">ชื่ออุปกรณ์</th>
              <th className="px-6 py-3 text-center">สภาพเครื่อง</th>
              <th className="px-6 py-3 text-center">สถานะการยืม</th>
              <th className="px-6 py-3 text-right">จัดการ</th>
            </tr>
          </thead>
          
          <tbody className="bg-white divide-y divide-gray-100">
            {data.map((item) => {
                const isBorrowed = item.borrowItems.length > 0;

                return (
                  <tr key={item.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-6 py-4 font-mono font-semibold text-blue-600">
                        <span className="bg-blue-50 px-2 py-1 rounded-md border border-blue-100">
                            {item.code}
                        </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-700">{item.name}</td>
                    
                    <td className="px-6 py-4 text-center">
                        {item.isActive 
                            ? <Badge variant="default" className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">สภาพดี</Badge>
                            : <Badge variant="default" className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">ส่งซ่อม/เสีย</Badge>
                        }
                    </td>

                    <td className="px-6 py-4 text-center">
                        {isBorrowed ? (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 text-orange-600 border border-orange-100">
                                <XCircle className="w-3.5 h-3.5" />
                                <span className="text-xs font-bold">ไม่ว่าง</span>
                            </div>
                        ) : (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 text-green-600 border border-green-100">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span className="text-xs font-bold">ว่าง</span>
                            </div>
                        )}
                    </td>

                    <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                            <EquipmentDialog 
                                mode="edit" 
                                initialData={item} 
                                trigger={
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-orange-500 hover:bg-orange-50">
                                        <Edit className="w-4 h-4" />
                                    </Button>
                                } 
                            />
                            <Button 
                                variant="ghost" size="icon" 
                                className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50" 
                                onClick={() => setTargetDelete({ id: item.id, name: item.name })}
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    </td>
                  </tr>
                )
            })}
          </tbody>
        </table>
      </div>

      {/* ✅ Modal แจ้งเตือนสวยๆ (เหมือนเดิม) */}
      <AlertDialog open={!!targetDelete} onOpenChange={(open) => !open && setTargetDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 text-red-600 mb-2">
                <div className="p-3 bg-red-100 rounded-full border-4 border-red-50">
                    <AlertTriangle className="w-6 h-6" />
                </div>
                <AlertDialogTitle className="text-xl">ยืนยันการลบอุปกรณ์?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-gray-600 text-base">
              คุณต้องการลบอุปกรณ์ <b>"{targetDelete?.name}"</b> ออกจากคลังใช่หรือไม่? <br/>
              <span className="text-xs text-red-500 mt-3 block bg-red-50 p-2 rounded-lg border border-red-100">
                ⚠️ การลบนี้ไม่สามารถย้อนกลับได้ และประวัติการยืมของอุปกรณ์นี้อาจได้รับผลกระทบ
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={isDeleting} className="border-gray-200">ยกเลิก</AlertDialogCancel>
            <AlertDialogAction 
                onClick={(e) => { e.preventDefault(); handleDelete(); }} 
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700 text-white border-red-600"
            >
              {isDeleting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> กำลังลบ...</> : 'ยืนยันลบ'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}