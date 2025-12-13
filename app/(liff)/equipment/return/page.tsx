"use client";

import { useState, useEffect } from "react";
import {
  Loader2,
  Package,
  Calendar,
  User,
  CheckCircle2,
  Clock,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import liff from "@line/liff";

import {
  getMyBorrowedEquipments,
  createReturnRequest,
} from "@/actions/equipment.actions";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default function ReturnForm() {
  const [isLoading, setIsLoading] = useState(true);
  const [liffReady, setLiffReady] = useState(false);
  const [lineId, setLineId] = useState<string | null>(null);
  const [borrows, setBorrows] = useState<any[]>([]);

  // Init
  useEffect(() => {
    const init = async () => {
      // ---------------------------------------------------------
      // 🚀 LIFF Mode
      // ---------------------------------------------------------
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID || "";
      try {
        await liff.init({ liffId, withLoginOnExternalBrowser: true });
        if (liff.isLoggedIn()) {
          const profile = await liff.getProfile();
          setLineId(profile.userId);
          await fetchData(profile.userId);
          setLiffReady(true);
        } else {
          liff.login();
        }
      } catch (e) {
        console.error(e);
        // setLiffReady(true); // Uncomment for testing
      }
      
      // ---------------------------------------------------------
      // 🛠️ Mock Mode
      // ---------------------------------------------------------
      /*
      const mockLineId = "U94e2bc37bfc6ea22b33c14a3c905b8aa";
      setLineId(mockLineId);
      await fetchData(mockLineId);
      setLiffReady(true);
      */
    };

    init();
  }, []);

  const fetchData = async (uid: string) => {
    setIsLoading(true);
    try {
      const res = await getMyBorrowedEquipments(uid);
      if (res.success && res.data) {
        setBorrows(res.data);
      } else {
        toast.error(res.error || "ไม่สามารถดึงข้อมูลได้");
      }
    } catch (e) {
      console.error(e);
      toast.error("เกิดข้อผิดพลาด");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReturn = async (borrowId: number) => {
    const confirm = window.confirm("ยืนยันการแจ้งคืนอุปกรณ์?");
    if (!confirm) return;

    try {
      const res = await createReturnRequest(borrowId);
      
      if (res.success) {
        toast.success("แจ้งคืนอุปกรณ์เรียบร้อย");
    
        setTimeout(() => {
            if (liff.isInClient()) {
                liff.closeWindow();
            }
        }, 1000);
        // --------------------------
        
      } else {
        toast.error(res.error);
      }
    } catch (e) {
      toast.error("เกิดข้อผิดพลาด");
    }
};

  if (!liffReady || isLoading)
    return (
      <div className="h-screen flex items-center justify-center bg-orange-50">
        <Loader2 className="animate-spin text-orange-500 w-10 h-10" />
      </div>
    );

  return (
    <div className="min-h-screen bg-orange-50 pb-10 font-sans">
      {/* Header - Theme Orange */}
      <div className="relative bg-white pb-10 rounded-b-[2.5rem] shadow-lg overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-orange-50 to-white pointer-events-none" />

        <div className="relative z-10 pt-10 px-6 text-center">
          <div className="mx-auto w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center mb-3 shadow-sm border border-orange-100">
             <Package className="w-8 h-8 text-orange-600" />
          </div>
          <h1 className="text-2xl font-black text-slate-800 mb-1 tracking-tight">
            คืนอุปกรณ์ครุภัณฑ์
          </h1>
          <p className="text-slate-500 text-sm font-medium">
            รายการอุปกรณ์ที่กำลังยืมอยู่
          </p>
        </div>
      </div>

      <div className="px-5 -mt-6 relative z-20 max-w-lg mx-auto space-y-4">
        {borrows.length === 0 ? (
          <div className="bg-white p-8 rounded-3xl shadow-xl shadow-orange-900/5 border border-white/50 text-center">
            <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4 text-orange-300">
              <Package className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-700">ไม่พบรายการยืม</h3>
            <p className="text-slate-400 text-sm">
              คุณยังไม่มีรายการอุปกรณ์ที่กำลังยืมอยู่
            </p>
          </div>
        ) : (
          borrows.map((borrow) => (
            <div
              key={borrow.id}
              className="bg-white p-5 rounded-3xl shadow-xl shadow-orange-900/5 border border-white/50 overflow-hidden relative"
            >
              {/* Status Badge */}
              <div
                className={cn(
                  "absolute top-0 right-0 px-4 py-2 rounded-bl-2xl text-xs font-bold tracking-wide uppercase flex items-center gap-1.5",
                  // 🟡 รอคืน
                  borrow.status === "RETURN_PENDING"
                    ? "bg-yellow-100 text-yellow-700" 
                    // 🟢 กำลังยืม (APPROVED)
                    : "bg-green-100 text-green-700"
                )}
              >
                {borrow.status === "RETURN_PENDING" ? (
                  <>
                    <Clock className="w-3 h-3" /> รอตรวจสอบการคืน
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3 h-3" /> กำลังยืม
                  </>
                )}
              </div>

              {/* Dependent Info */}
              <div className="flex items-center gap-3 mb-4 mt-2">
                <div className="w-10 h-10 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-600 shrink-0">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    ผู้ใช้งาน
                  </p>
                  <h3 className="text-base font-bold text-slate-800">
                    {borrow.dependent.firstName} {borrow.dependent.lastName}
                  </h3>
                </div>
              </div>

              {/* Date */}
              <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100 w-fit">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-medium text-slate-600">
                  ยืมเมื่อ:{" "}
                  {format(new Date(borrow.borrowDate), "d MMM yyyy", {
                    locale: th,
                  })}
                </span>
              </div>

              {/* Items List */}
              <div className="space-y-2 mb-5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                  รายการอุปกรณ์
                </p>
                {borrow.items.map((item: any) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 bg-orange-50/50 rounded-2xl border border-orange-100"
                  >
                    <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-orange-500 shadow-sm shrink-0">
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-700 text-sm">
                        {item.equipment.name}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {item.equipment.code}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Button */}
              {borrow.status === "APPROVED" && (
                <button
                  onClick={() => handleReturn(borrow.id)}
                  className="w-full py-3 bg-white border-2 border-orange-100 text-orange-600 font-bold text-sm rounded-2xl hover:bg-orange-50 hover:border-orange-200 transition-all flex items-center justify-center gap-2"
                >
                  <span>แจ้งคืนอุปกรณ์</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {borrow.status === "RETURN_PENDING" && (
                <div className="w-full py-3 bg-slate-50 border border-slate-100 text-slate-400 font-bold text-sm rounded-2xl flex items-center justify-center gap-2 cursor-not-allowed">
                  <Clock className="w-4 h-4" />
                  <span>แจ้งคืนแล้ว (รอเจ้าหน้าที่)</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}