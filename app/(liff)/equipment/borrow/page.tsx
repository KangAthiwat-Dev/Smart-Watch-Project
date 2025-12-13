"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Loader2,
  Plus,
  Trash2,
  User,
  MapPin,
  Package,
  ChevronDown,
  Save,
  FileText,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import liff from "@line/liff";

import { getCaregiverByLineId } from "@/actions/user.actions";
import { getDependentsByCaregiverLineId } from "@/actions/dependent.actions";
import {
  getAvailableEquipments,
  createBorrowRequest,
} from "@/actions/equipment.actions";
import { Equipment } from "@prisma/client";

const borrowSchema = z.object({
  dependentId: z.string().min(1, "กรุณาเลือกผู้สูงอายุ"),
  objective: z.string().min(1, "กรุณาระบุเหตุผล"),
  equipmentIds: z.array(z.number()).min(1, "กรุณาเลือกอุปกรณ์ 1 ชิ้น"),
});

type BorrowFormInput = z.infer<typeof borrowSchema>;

export default function BorrowForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [liffReady, setLiffReady] = useState(false);
  const [lineId, setLineId] = useState<string | null>(null);

  // Data
  const [caregiver, setCaregiver] = useState<any>(null);
  const [dependents, setDependents] = useState<any[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);

  const form = useForm<BorrowFormInput>({
    resolver: zodResolver(borrowSchema),
    defaultValues: {
      dependentId: "",
      objective: "",
      equipmentIds: [],
    },
  });

  // Init
  useEffect(() => {
    const init = async () => {
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID || "";
      try {
        await liff.init({ liffId, withLoginOnExternalBrowser: true });
        if (liff.isLoggedIn()) {
           const profile = await liff.getProfile();
           setLineId(profile.userId);
           await fetchData(profile.userId);
           setLiffReady(true);
        } else { liff.login(); }
      } catch (e) {
         console.error(e);
      }
    };
    init();
  }, []);

  const fetchData = async (uid: string) => {
    try {
      const [cgRes, depRes, eqRes] = await Promise.all([
        getCaregiverByLineId(uid),
        getDependentsByCaregiverLineId(uid),
        getAvailableEquipments(),
      ]);

      if (cgRes.success && cgRes.data) {
        setCaregiver(cgRes.data);
      }
      if (depRes.success && depRes.data) {
        setDependents(depRes.data);
        if (depRes.data.length > 0) {
          form.setValue("dependentId", depRes.data[0].id.toString());
        }
      }
      if (eqRes.success && eqRes.data) {
        setEquipments(eqRes.data);
      }
    } catch (e) {
      console.error(e);
      toast.error("โหลดข้อมูลไม่สำเร็จ");
    }
  };

  const onSubmit = async (data: BorrowFormInput) => {
    if (!lineId || !caregiver) {
        toast.error("ไม่พบข้อมูลผู้ยืม");
        return;
    }
    setIsLoading(true);
    try {
      const res = await createBorrowRequest({
        caregiverId: caregiver.id,
        dependentId: parseInt(data.dependentId),
        objective: data.objective,
        borrowDate: new Date(), 
        equipmentIds: data.equipmentIds,
      });

      if (res.success) {
        toast.success("ส่งคำขอยืมเรียบร้อยแล้ว");
        
        setTimeout(() => {
            liff.closeWindow();
        }, 1000);

      } else {
        toast.error(res.error);
      }
    } catch (e) {
      toast.error("เกิดข้อผิดพลาด");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleEquipment = (id: number) => {
    const current = form.getValues("equipmentIds");
    if (current.includes(id)) {
      form.setValue("equipmentIds", []);
    } else {
      form.setValue("equipmentIds", [id]);
    }
  };

  const formatPhone = (phone: string | undefined) => {
    if (!phone) return "-";
    return phone.replace(/^\+66/, "0");
  };

  if (!liffReady)
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-blue-600 w-10 h-10" />
      </div>
    );

  if (!caregiver)
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 text-slate-500">
        ไม่พบข้อมูลผู้ดูแล (กรุณาลงทะเบียนก่อน)
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50 pb-10 font-sans">
      {/* Header - ธีมขาว Clean White */}
      <div className="relative bg-white pb-10 rounded-b-[2.5rem] shadow-lg overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-blue-50 to-white pointer-events-none" />

        <div className="relative z-10 pt-10 px-6 text-center">
          <div className="mx-auto w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-3 shadow-sm border border-blue-100">
             <Package className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-black text-slate-800 mb-1 tracking-tight">
            ยืมอุปกรณ์ครุภัณฑ์
          </h1>
          <p className="text-slate-500 text-sm font-medium">
            กรอกข้อมูลเพื่อยื่นคำขอยืมอุปกรณ์
          </p>
        </div>
      </div>

      <div className="px-5 -mt-6 relative z-20 max-w-lg mx-auto space-y-6">
        {/* 1. Caregiver Info */}
        <div className="bg-white p-6 rounded-3xl shadow-xl shadow-blue-900/5 border border-white/50">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
              <User className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">ข้อมูลผู้ยืม</h2>
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                ชื่อผู้ดูแล
              </label>
              <div className="w-full px-4 py-3 bg-slate-50 rounded-2xl border-0 font-bold text-slate-700">
                {caregiver.firstName} {caregiver.lastName}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Dependent Info */}
        <div className="bg-white p-6 rounded-3xl shadow-xl shadow-blue-900/5 border border-white/50">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Users className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">
              ข้อมูลผู้สูงอายุ
            </h2>
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                เลือกผู้สูงอายุ
              </label>
              <div className="relative">
                <select
                  {...form.register("dependentId")}
                  className="w-full px-4 py-3 bg-slate-50 rounded-2xl border-0 font-bold text-slate-700 appearance-none focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                >
                  {dependents.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.firstName} {d.lastName}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-3.5 w-5 h-5 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* 3. Address & Phone */}
        <div className="bg-white p-6 rounded-3xl shadow-xl shadow-blue-900/5 border border-white/50">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 flex items-center justify-center text-teal-600">
              <MapPin className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">
              ที่อยู่และเบอร์โทร
            </h2>
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                ที่อยู่
              </label>
              <div className="w-full px-4 py-3 bg-slate-50 rounded-2xl border-0 font-medium text-slate-600 text-sm min-h-[80px]">
                {caregiver.houseNumber} หมู่ {caregiver.village}{" "}
                {caregiver.road ? `ถ.${caregiver.road}` : ""}
                <br />
                ต.{caregiver.subDistrict} อ.{caregiver.district}
                <br />
                จ.{caregiver.province} {caregiver.postalCode}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                เบอร์โทรศัพท์
              </label>
              <div className="w-full px-4 py-3 bg-slate-50 rounded-2xl border-0 font-bold text-slate-700">
                {formatPhone(caregiver.phone)}
              </div>
            </div>
          </div>
        </div>

        {/* 4. Equipment Selection */}
        <div className="bg-white p-6 rounded-3xl shadow-xl shadow-blue-900/5 border border-white/50">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-600">
              <Package className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">รายการอุปกรณ์</h2>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              {form.watch("equipmentIds").length === 0 && (
                <div className="text-center py-6 text-slate-400 text-sm bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                  ยังไม่ได้เลือกอุปกรณ์ (เลือกได้ 1 ชิ้น)
                </div>
              )}
              {form.watch("equipmentIds").map((id) => {
                const eq = equipments.find((e) => e.id === id);
                if (!eq) return null;
                return (
                  <div
                    key={id}
                    className="flex items-center justify-between p-3 bg-blue-50 rounded-2xl border border-blue-100 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
                        <Package className="w-5 h-5" />
                      </div>
                      <span className="font-bold text-slate-700 text-sm">
                        {eq.name}
                      </span>
                    </div>
                    <button
                      onClick={() => toggleEquipment(id)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Add Button */}
            <div className="space-y-2 pt-2">
              <p className="text-xs font-bold text-slate-400 ml-1 mb-2 uppercase tracking-wider">
                เลือกอุปกรณ์ที่ต้องการยืม
              </p>
              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {equipments
                  .filter((e) => !form.watch("equipmentIds").includes(e.id))
                  .map((eq) => (
                    <button
                      key={eq.id}
                      onClick={() => toggleEquipment(eq.id)}
                      className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-blue-50 rounded-2xl border border-slate-100 hover:border-blue-200 transition-all text-left group"
                    >
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 group-hover:text-blue-600 shadow-sm transition-colors">
                        <Plus className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-700 text-sm group-hover:text-blue-800">
                          {eq.name}
                        </div>
                        <div className="text-[10px] text-slate-400 group-hover:text-blue-500">
                          {eq.code}
                        </div>
                      </div>
                    </button>
                  ))}
                {equipments.length === 0 && (
                  <div className="text-center text-sm text-slate-400 py-2">
                    ไม่มีอุปกรณ์ว่าง
                  </div>
                )}
              </div>
            </div>
            {form.formState.errors.equipmentIds && (
              <p className="text-xs text-red-500 mt-2 ml-1 font-medium">
                {form.formState.errors.equipmentIds.message}
              </p>
            )}
          </div>
        </div>

        {/* 5. Reason */}
        <div className="bg-white p-6 rounded-3xl shadow-xl shadow-blue-900/5 border border-white/50">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600">
              <FileText className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">
              รายละเอียดเพิ่มเติม
            </h2>
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                เหตุผล (ระบุลักษณะอาการหรือข้อจำกัด)
              </label>
              <textarea
                {...form.register("objective")}
                className="w-full px-4 py-3 bg-slate-50 rounded-2xl border-0 focus:ring-2 focus:ring-blue-500/20 transition-all font-medium text-slate-700 min-h-[100px] placeholder:text-slate-300 outline-none"
                placeholder="เช่น ภาวะหลงลืม เดินหลงทาง..."
              />
              {form.formState.errors.objective && (
                <p className="text-xs text-red-500 ml-1">
                  {form.formState.errors.objective.message}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          onClick={form.handleSubmit(onSubmit)}
          disabled={isLoading}
          className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-lg rounded-2xl shadow-lg shadow-blue-500/30 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:scale-100 hover:shadow-xl hover:shadow-blue-600/40"
        >
          {isLoading ? (
            <Loader2 className="animate-spin w-6 h-6" />
          ) : (
            <>
              <Save className="w-5 h-5" />
              <span>บันทึกคำขอ</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}