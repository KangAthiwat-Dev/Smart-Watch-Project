"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { updateTransactionStatus } from "@/actions/equipment.actions";

interface TransactionModalProps {
  transaction: any;
  isOpen: boolean;
  onClose: () => void;
  view?: "borrow" | "return";
}

export default function TransactionModal({
  transaction,
  isOpen,
  onClose,
  view = "borrow",
}: TransactionModalProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string>("");

  // Reset status เมื่อเปิด Modal ใหม่
  useEffect(() => {
    if (transaction) { 
      setStatus(transaction.status || "");
    }
  }, [transaction]);

  const handleSave = async () => {
    if (!transaction) return;
    setIsLoading(true);

    if (!status) {
      toast.error("กรุณาเลือกสถานะ");
      setIsLoading(false);
      return;
    }

    try {
      // เรียก Server Action
      const res = await updateTransactionStatus(transaction.id, status);
      
      if (res.success) {
        toast.success("บันทึกสถานะเรียบร้อย");
        router.refresh(); // รีเฟรชข้อมูลในตาราง
        handleClose();    // ปิด Modal
      } else {
        toast.error(res.error || "บันทึกไม่สำเร็จ");
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    // ลบ Query Params ออกจาก URL เพื่อปิด Modal แบบ Clean
    const params = new URLSearchParams(window.location.search);
    params.delete("transactionId");
    router.push(`?${params.toString()}`, { scroll: false });
    onClose();
  };

  if (!transaction) return null;

  // Helper สำหรับดึงที่อยู่ (Safe Access)
  const getAddress = (profile: any) => {
    if (!profile) return "-";
    // เช็คเผื่อ field ไม่มี
    const parts = [
      profile.houseNumber ? `บ้านเลขที่ ${profile.houseNumber}` : "",
      profile.village ? `หมู่ ${profile.village}` : "",
      profile.subDistrict ? `ต.${profile.subDistrict}` : "",
      profile.district ? `อ.${profile.district}` : "",
      profile.province ? `จ.${profile.province}` : "",
      profile.postalCode || ""
    ];
    return parts.filter(Boolean).join(" ") || "-";
  };

  // Helper สีสถานะ
  const getStatusColor = (s: string) => {
    switch (s) {
      case "APPROVED":
      case "RETURNED":
        return "text-green-600 bg-green-50 px-2 py-1 rounded-md";
      case "REJECTED":
      case "RETURN_FAILED":
        return "text-red-600 bg-red-50 px-2 py-1 rounded-md";
      case "PENDING":
      case "RETURN_PENDING":
        return "text-yellow-600 bg-yellow-50 px-2 py-1 rounded-md";
      default:
        return "text-slate-600";
    }
  };

  const getStatusLabel = (s: string) => {
    const map: Record<string, string> = {
      PENDING: "รออนุมัติ",
      APPROVED: "อนุมัติแล้ว",
      REJECTED: "ไม่อนุมัติ",
      RETURN_PENDING: "รอตรวจสอบคืน",
      RETURNED: "คืนสำเร็จ",
      RETURN_FAILED: "คืนไม่สำเร็จ"
    };
    return map[s] || s;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0 rounded-2xl border-0 shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex flex-col">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                {view === 'borrow' ? 'คำขอยืมครุภัณฑ์' : 'แจ้งคืนครุภัณฑ์'}
            </span>
            <DialogTitle className="text-xl font-bold text-slate-800 mt-1">
                {transaction.dependent.firstName} {transaction.dependent.lastName}
            </DialogTitle>
          </div>
          <button onClick={handleClose} className="p-2 bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 bg-[#F8FAFC]">
          
          {/* ข้อมูลทั่วไป */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                <tr>
                    <td className="py-3 px-4 font-bold text-slate-500 w-1/3 bg-slate-50/50">ผู้ยื่นคำขอ</td>
                    <td className="py-3 px-4 text-slate-700 font-medium">
                        {transaction.borrower.firstName} {transaction.borrower.lastName} 
                        <span className="text-slate-400 text-xs ml-2">({transaction.borrower.phone || "-"})</span>
                    </td>
                </tr>
                <tr>
                    <td className="py-3 px-4 font-bold text-slate-500 bg-slate-50/50">ผู้สูงอายุ</td>
                    <td className="py-3 px-4 text-slate-700 font-medium">{transaction.dependent.firstName} {transaction.dependent.lastName}</td>
                </tr>
                <tr>
                    <td className="py-3 px-4 font-bold text-slate-500 bg-slate-50/50">ที่อยู่จัดส่ง</td>
                    <td className="py-3 px-4 text-slate-600 leading-relaxed">{getAddress(transaction.borrower)}</td>
                </tr>
                <tr>
                    <td className="py-3 px-4 font-bold text-slate-500 bg-slate-50/50">เหตุผล</td>
                    <td className="py-3 px-4 text-slate-600 italic">"{transaction.objective || "-"}"</td>
                </tr>
                <tr>
                    <td className="py-3 px-4 font-bold text-slate-500 bg-slate-50/50">วันที่ยื่นเรื่อง</td>
                    <td className="py-3 px-4 text-slate-700">
                        {format(new Date(transaction.borrowDate), "d MMMM yyyy", { locale: th })}
                    </td>
                </tr>
                <tr>
                    <td className="py-3 px-4 font-bold text-slate-500 bg-slate-50/50">สถานะปัจจุบัน</td>
                    <td className="py-3 px-4">
                        <span className={`text-xs font-bold ${getStatusColor(transaction.status)}`}>
                            {getStatusLabel(transaction.status)}
                        </span>
                    </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* รายการอุปกรณ์ */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                อุปกรณ์ในรายการ
                <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-xs">{transaction.items.length}</span>
            </h3>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 w-12 text-center">#</th>
                    <th className="px-4 py-3">ชื่ออุปกรณ์</th>
                    <th className="px-4 py-3 text-right">รหัสครุภัณฑ์</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transaction.items.map((item: any, index: number) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-center text-slate-400">{index + 1}</td>
                      <td className="px-4 py-3 text-slate-700 font-bold">{item.equipment.name}</td>
                      <td className="px-4 py-3 text-right text-slate-500 font-mono text-xs">{item.equipment.code}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Zone: เปลี่ยนสถานะ */}
          <div className="bg-orange-50/50 p-4 rounded-xl border border-orange-100">
            <h3 className="text-sm font-bold text-orange-800 mb-2">
              จัดการสถานะ:
            </h3>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full h-12 bg-white border-orange-200 rounded-xl focus:ring-orange-500 text-orange-900 font-medium shadow-sm">
                <SelectValue placeholder="เลือกการดำเนินการ" />
              </SelectTrigger>
              <SelectContent>
                {view === "borrow" ? (
                  <>
                    <SelectItem value="PENDING">รออนุมัติ</SelectItem>
                    <SelectItem value="APPROVED">อนุมัติให้ยืม</SelectItem>
                    <SelectItem value="REJECTED">ปฏิเสธคำขอ</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="RETURN_PENDING">รอตรวจสอบคืน</SelectItem>
                    <SelectItem value="RETURNED">ยืนยันรับของคืน</SelectItem>
                    <SelectItem value="RETURN_FAILED">ของเสียหาย/ไม่ครบ</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-orange-600/70 mt-2">
                * การเปลี่ยนสถานะจะมีผลกับสต็อกอุปกรณ์ทันที
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white border-t border-slate-100 flex justify-end gap-3 sticky bottom-0 z-10">
          <Button
            variant="ghost"
            onClick={handleClose}
            className="text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl px-6"
          >
            ปิดหน้าต่าง
          </Button>
          <Button
            onClick={handleSave}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white border-0 rounded-xl px-6 shadow-md shadow-blue-200 transition-all active:scale-95"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            บันทึกสถานะ
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}