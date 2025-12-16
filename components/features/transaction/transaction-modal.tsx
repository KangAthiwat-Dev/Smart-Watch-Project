"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, X, Save, Activity, CheckCircle, XCircle, Edit, AlertCircle, History, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { updateTransactionStatus, getTransactionById } from "@/actions/equipment.actions";

interface TransactionModalProps {
  transactionId: number | null;
  isOpen: boolean;
  onClose: () => void;
  view?: "borrow" | "return";
}

export default function TransactionModal({
  transactionId,
  isOpen,
  onClose,
  view = "borrow",
}: TransactionModalProps) {
  const router = useRouter();

  const [transaction, setTransaction] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editReason, setEditReason] = useState("");
  const [tempStatus, setTempStatus] = useState<string>("");

  const fetchTransactionData = () => {
    if (!transactionId) return;
    setLoadingData(true);
    getTransactionById(transactionId).then((res) => {
        if (res.success && res.data) {
          setTransaction(res.data);
          setTempStatus(res.data.status);
        } else {
          toast.error("ไม่สามารถโหลดข้อมูลได้");
        }
        setLoadingData(false);
    });
  };

  useEffect(() => {
    if (isOpen && transactionId) {
      setEditReason("");
      setIsEditing(false);
      fetchTransactionData();
    }
  }, [isOpen, transactionId]);

  const handleStatusUpdate = async (newStatus: string) => {
    if (!transaction) return;
    setIsSaving(true);

    try {
      const res = await updateTransactionStatus(transaction.id, newStatus, editReason);
      
      if (res.success) {
        toast.success(isEditing ? "แก้ไขสถานะเรียบร้อย" : "บันทึกสถานะเรียบร้อย");
        setIsEditing(false);
        setEditReason("");
        router.refresh();
        fetchTransactionData();
      } else {
        toast.error(res.error || "บันทึกไม่สำเร็จ");
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาด");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    const params = new URLSearchParams(window.location.search);
    params.delete("transactionId");
    router.push(`?${params.toString()}`, { scroll: false });
    onClose();
  };

  const getAddress = (profile: any) => {
    if (!profile) return "-";
    return [
      profile.houseNumber ? `บ้านเลขที่ ${profile.houseNumber}` : "",
      profile.village ? `หมู่ ${profile.village}` : "",
      profile.subDistrict ? `ต.${profile.subDistrict}` : "",
      profile.district ? `อ.${profile.district}` : "",
      profile.province ? `จ.${profile.province}` : "",
      profile.postalCode || ""
    ].filter(Boolean).join(" ") || "-";
  };

  const getStatusBadgeVariant = (s: string) => {
    switch (s) {
      case "APPROVED": case "RETURNED": return "bg-green-100 text-green-700 hover:bg-green-100 border-green-200";
      case "REJECTED": case "RETURN_FAILED": return "bg-red-100 text-red-700 hover:bg-red-100 border-red-200";
      case "PENDING": case "RETURN_PENDING": return "bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-yellow-200";
      default: return "bg-slate-100 text-slate-700";
    }
  };

  const getStatusLabel = (s: string) => {
    const map: Record<string, string> = {
      PENDING: "รออนุมัติ", APPROVED: "อนุมัติแล้ว", REJECTED: "ไม่อนุมัติ",
      RETURN_PENDING: "รอตรวจสอบคืน", RETURNED: "คืนสำเร็จ", RETURN_FAILED: "คืนไม่สำเร็จ"
    };
    return map[s] || s;
  };

  const formatThaiDateTime = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    const buddhistYear = date.getFullYear() + 543;
    return `${format(date, "d MMM", { locale: th })} ${buddhistYear} เวลา ${format(date, "HH:mm")} น.`;
  };

  const getAdminName = (user: any) => {
    if (!user) return "-";
    if (user.adminProfile) {
        return `${user.adminProfile.firstName} ${user.adminProfile.lastName}`;
    }
    return user.username || "Admin"; 
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0 rounded-2xl border-0 shadow-2xl">
        
        {/* 🟡 ส่วน Loading: Heart Radar กลับมาแล้ว! */}
        {loadingData || !transaction ? (
             <div className="h-[350px] flex flex-col items-center justify-center bg-white/50 backdrop-blur-sm">
                
                <DialogTitle className="hidden">กำลังโหลดข้อมูล</DialogTitle>

                <div className="relative flex flex-col items-center scale-90">
                    <div className="relative flex h-20 w-20 items-center justify-center">
                        {/* วงแหวนเรดาร์ */}
                        <div className="absolute inset-0 h-full w-full rounded-full bg-blue-400 opacity-20 animate-ping"></div>
                        
                        <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-white/50 bg-white/60 shadow-lg backdrop-blur-md">
                            {/* ไอคอนหมุน */}
                            <div className="absolute inset-0 h-full w-full animate-spin rounded-full border-4 border-slate-100 border-t-blue-600"></div>
                            {/* ไอคอนหัวใจ */}
                            <Activity className="h-6 w-6 text-blue-600" />
                        </div>
                    </div>

                    <div className="mt-6 flex flex-col items-center gap-1 text-center">
                        <h2 className="text-base font-semibold text-slate-700">Loading...</h2>
                        <p className="text-[10px] font-medium text-slate-400">กำลังดึงข้อมูลรายละเอียด</p>
                    </div>
                </div>
             </div>
        ) : (
            // 🟢 ส่วนเนื้อหาจริง
            <>
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                    <div className="flex flex-col">
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                            {view === 'borrow' ? 'คำขอยืมครุภัณฑ์' : 'แจ้งคืนครุภัณฑ์'}
                        </span>
                        <DialogTitle className="text-xl font-bold text-slate-800 mt-1">
                            คุณ{transaction.dependent.firstName} {transaction.dependent.lastName}
                        </DialogTitle>
                    </div>
                   <button onClick={handleClose}><X className="w-5 h-5 text-slate-400" /></button>
                </div>

                <div className="p-6 space-y-6 bg-[#F8FAFC]">
                    
                    {/* 1. ตารางข้อมูลหลัก */}
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <table className="w-full text-sm">
                        <tbody className="divide-y divide-slate-100">
                            <tr>
                                <td className="py-3 px-4 font-bold text-slate-500 w-1/3 bg-slate-50/50">ผู้ยื่นคำขอ</td>
                                <td className="py-3 px-4 text-slate-700 font-medium">{transaction.borrower.firstName} {transaction.borrower.lastName}</td>
                            </tr>
                            <tr>
                                <td className="py-3 px-4 font-bold text-slate-500 bg-slate-50/50">ผู้ที่มีภาวะพึ่งพิง</td>
                                <td className="py-3 px-4 text-slate-700 font-medium">{transaction.dependent.firstName} {transaction.dependent.lastName}</td>
                            </tr>
                            <tr>
                                <td className="py-3 px-4 font-bold text-slate-500 bg-slate-50/50">ที่อยู่</td>
                                <td className="py-3 px-4 text-slate-600 leading-relaxed">{getAddress(transaction.borrower)}</td>
                            </tr>
                             <tr>
                                <td className="py-3 px-4 font-bold text-slate-500 bg-slate-50/50">เบอร์โทร</td>
                                <td className="py-3 px-4 text-slate-700">{transaction.borrower.phone || "-"}</td>
                            </tr>
                            <tr>
                                <td className="py-3 px-4 font-bold text-slate-500 bg-slate-50/50">เหตุผล</td>
                                <td className="py-3 px-4 text-slate-600 italic">"{transaction.objective || "-"}"</td>
                            </tr>
                            <tr>
                                <td className="py-3 px-4 font-bold text-slate-500 bg-slate-50/50">วันที่ยื่นเรื่อง</td>
                                <td className="py-3 px-4 text-slate-700">{formatThaiDateTime(transaction.borrowDate).split(" เวลา")[0]}</td>
                            </tr>
                            <tr>
                                <td className="py-3 px-4 font-bold text-slate-500 bg-slate-50/50">สถานะ</td>
                                <td className="py-3 px-4 flex items-center gap-2">
                                    <Badge className={`${getStatusBadgeVariant(transaction.status)} border px-3 py-1 rounded-lg text-sm font-bold shadow-sm pointer-events-none`}>
                                        {getStatusLabel(transaction.status)}
                                    </Badge>
                                    
                                    {transaction.isEdited && <span className="text-xs text-slate-400 italic font-medium ml-1">(แก้ไข)</span>}
                                </td>
                            </tr>
                        </tbody>
                        </table>
                    </div>

                    {/* 2. ตารางผู้อนุมัติ (แสดงเมื่ออนุมัติแล้ว) */}
                    {(transaction.status !== 'PENDING' && transaction.status !== 'RETURN_PENDING') && (
                        <div>
                             <h3 className="text-sm font-bold text-slate-700 mb-2 pl-1">การอนุมัติ</h3>
                             <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                <table className="w-full text-sm">
                                <tbody className="divide-y divide-slate-100">
                                    <tr>
                                        <td className="py-3 px-4 font-bold text-slate-500 w-1/3 bg-slate-50/50">ผู้อนุมัติ</td>
                                        <td className="py-3 px-4 text-slate-700 font-medium">
                                            {getAdminName(transaction.approver)}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="py-3 px-4 font-bold text-slate-500 bg-slate-50/50">อนุมัติเมื่อ</td>
                                        <td className="py-3 px-4 text-slate-700">
                                            {transaction.approvedAt ? formatThaiDateTime(transaction.approvedAt) : "-"}
                                        </td>
                                    </tr>
                                </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* 3. รายการอุปกรณ์ */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-700 mb-2 pl-1">เครื่องที่ยืม</h3>
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                            <tr>
                                <td className="px-4 py-3 font-bold w-1/3 text-slate-500">รายการ</td>
                                <td className="px-4 py-3 font-bold text-right text-slate-500">ID เครื่อง</td>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                            {transaction.items.map((item: any) => (
                                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3 text-slate-700 font-bold">{item.equipment.name}</td>
                                <td className="px-4 py-3 text-right text-slate-500 font-mono text-xs">{item.equipment.code}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                        </div>
                    </div>

                    {/* 4. Action Zone & History Log */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-slate-800">การดำเนินการ</h3>
                            {(transaction.status !== 'PENDING' && transaction.status !== 'RETURN_PENDING' && !isEditing) && (
                                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="text-blue-600 border-blue-200 hover:bg-blue-50">
                                    <Edit className="w-4 h-4 mr-2" /> แก้ไขสถานะ
                                </Button>
                            )}
                        </div>

                        {/* ปุ่มกดอนุมัติ/ไม่อนุมัติ */}
                        {((transaction.status === 'PENDING' || transaction.status === 'RETURN_PENDING') && !isEditing) ? (
                            <div className="grid grid-cols-2 gap-4">
                                <Button onClick={() => handleStatusUpdate(view === 'borrow' ? 'REJECTED' : 'RETURN_FAILED')} disabled={isSaving} className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 h-12">
                                    <XCircle className="w-5 h-5 mr-2" /> {view === 'borrow' ? 'ไม่อนุมัติ' : 'คืนไม่สำเร็จ'}
                                </Button>
                                <Button onClick={() => handleStatusUpdate(view === 'borrow' ? 'APPROVED' : 'RETURNED')} disabled={isSaving} className="bg-green-600 hover:bg-green-700 text-white h-12 shadow-md">
                                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <CheckCircle className="w-5 h-5 mr-2" />} {view === 'borrow' ? 'อนุมัติ' : 'อนุมัติการคืน'}
                                </Button>
                            </div>
                        ) : null}

                        {/* ฟอร์มแก้ไข */}
                        {isEditing && (
                            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex gap-3">
                                    <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0" />
                                    <div className="space-y-3 w-full">
                                        <p className="text-sm text-yellow-800 font-medium">การแก้ไขสถานะจำเป็นต้องระบุเหตุผล</p>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-yellow-700">เลือกสถานะใหม่:</Label>
                                            <Select value={tempStatus} onValueChange={setTempStatus}>
                                                <SelectTrigger className="bg-white border-yellow-300"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {view === 'borrow' ? (
                                                        <>
                                                            <SelectItem value="PENDING">รออนุมัติ</SelectItem>
                                                            <SelectItem value="APPROVED">อนุมัติ</SelectItem>
                                                            <SelectItem value="REJECTED">ไม่อนุมัติ</SelectItem>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <SelectItem value="RETURN_PENDING">รอตรวจสอบ</SelectItem>
                                                            <SelectItem value="RETURNED">คืนสำเร็จ</SelectItem>
                                                            <SelectItem value="RETURN_FAILED">คืนไม่สำเร็จ</SelectItem>
                                                        </>
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-yellow-700">เหตุผลในการแก้ไข:</Label>
                                            <Input value={editReason} onChange={(e) => setEditReason(e.target.value)} placeholder="เช่น กรอกสถานะผิดพลาด..." className="bg-white border-yellow-300"/>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>ยกเลิก</Button>
                                    <Button size="sm" disabled={!editReason || !tempStatus || isSaving} onClick={() => handleStatusUpdate(tempStatus)} className="bg-blue-600 text-white">
                                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} ยืนยันการแก้ไข
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* ประวัติการแก้ไข (History Log) */}
                        {transaction.history && transaction.history.length > 0 && (
                            <div className="mt-6 pt-4 border-t border-slate-100">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <History className="w-3 h-3" /> ประวัติการดำเนินการ
                                </h4>
                                <div className="space-y-3">
                                    {transaction.history.map((log: any, index: number) => (
                                        <div key={log.id} className="flex gap-3 text-sm bg-slate-50 p-3 rounded-lg border border-slate-100">
                                            <div className="flex-1 space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <span className={`font-bold text-xs ${getStatusBadgeVariant(log.action).split(' ')[1]}`}>
                                                        {log.action === 'EDIT' ? 'แก้ไขสถานะ' : getStatusLabel(log.action)}
                                                    </span>
                                                    <span className="text-xs text-slate-400 flex items-center gap-1">
                                                        <Clock className="w-3 h-3" /> {formatThaiDateTime(log.createdAt)}
                                                    </span>
                                                </div>
                                                <p className="text-slate-700">
                                                    <span className="font-semibold">{getAdminName(log.actor)}:</span> {log.reason || "ดำเนินการเปลี่ยนสถานะ"}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </>
        )}
      </DialogContent>
    </Dialog>
  );
}