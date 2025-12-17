"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import liff from "@line/liff";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  User,
  MapPin,
  Heart,
  Activity,
  ChevronDown,
  Calendar,
  Phone, // ✅ เพิ่ม Import Phone Icon
} from "lucide-react";

import {
  getDependentsByCaregiverLineId,
  updateDependentProfile,
} from "@/actions/dependent.actions";
import {
  dependentRegisterSchema,
  DependentRegisterInput,
} from "@/lib/validations/dependent-register.schema";
import {
  getThaiAddressData,
  ThaiProvince,
  ThaiAmphure,
  ThaiTambon,
} from "@/services/thai-data.service";

export default function DependentEditPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isAddressLoading, setIsAddressLoading] = useState(true);
  const [liffReady, setLiffReady] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [dependentId, setDependentId] = useState<number | null>(null);

  // Address State
  const [allProvinces, setAllProvinces] = useState<ThaiProvince[]>([]);
  const [amphureOptions, setAmphureOptions] = useState<ThaiAmphure[]>([]);
  const [tambonOptions, setTambonOptions] = useState<ThaiTambon[]>([]);

  const form = useForm<DependentRegisterInput>({
    resolver: zodResolver(dependentRegisterSchema),
    defaultValues: {
      lineId: "",
      gender: "UNSPECIFIED",
      marital: "SINGLE",
      birthday: new Date().toISOString().split("T")[0],
      pin: "",
      province: "",
      district: "",
      subDistrict: "",
      postalCode: "",
      firstName: "",
      lastName: "",
      phone: "",
      houseNumber: "",
      village: "",
      road: "",
      diseases: "",
      medications: "",
    },
  });

  useEffect(() => {
    const initData = async () => {
      try {
        setIsAddressLoading(true);

        const addressData = await getThaiAddressData();
        setAllProvinces(addressData);

        const fetchAndFill = async (caregiverLineId: string) => {
          const res = await getDependentsByCaregiverLineId(caregiverLineId);
          
          if (res.success && res.data && res.data.length > 0) {
            const d = res.data[0];
            setDependentId(d.id);

            // ✅ แก้ไข 1: Logic แสดงเบอร์โทร (แปลง +66 เป็น 0)
            let formattedPhone = d.phone || "";
            if (formattedPhone.startsWith("+66")) {
                formattedPhone = "0" + formattedPhone.substring(3);
            }

            form.reset({
              lineId: caregiverLineId,
              firstName: d.firstName,
              lastName: d.lastName,
              gender: d.gender as any,
              marital: d.marital as any,
              birthday: d.birthday ? new Date(d.birthday).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
              phone: formattedPhone, // ใช้เบอร์ที่แปลงแล้ว
              diseases: d.diseases || "",
              medications: d.medications || "",
              houseNumber: d.houseNumber || "",
              village: d.village || "",
              road: d.road || "",
              province: d.province || "",
              district: d.district || "",
              subDistrict: d.subDistrict || "",
              postalCode: d.postalCode || "",
              pin: d.pin || "", 
            });

            const prov = addressData.find((i) => i.name === d.province);
            if (prov) {
              setAmphureOptions(prov.amphure);
              const amp = prov.amphure.find((i) => i.name === d.district);
              if (amp) {
                setTambonOptions(amp.tambon);
              }
            }
          }
        };

        const liffId = process.env.NEXT_PUBLIC_LIFF_ID || "";
        try {
          await liff.init({
            liffId: liffId,
            withLoginOnExternalBrowser: true,
          });
        } catch (liffError: any) {
          console.error("LIFF Init Error:", liffError);
        }

        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        const userProfile = await liff.getProfile();
        setProfile(userProfile);
        form.setValue("lineId", userProfile.userId);

        await fetchAndFill(userProfile.userId);

        setLiffReady(true);
        setIsAddressLoading(false);

      } catch (error) {
        console.error("Critical Init Error:", error);
        setIsAddressLoading(false);
        setLiffReady(true); 
      }
    };

    initData();
  }, [form]);

  const handleProvinceChange = (provinceName: string) => {
    form.setValue("province", provinceName);
    form.setValue("district", "");
    form.setValue("subDistrict", "");
    form.setValue("postalCode", "");
    const province = allProvinces.find((p) => p.name === provinceName);
    setAmphureOptions(province ? province.amphure : []);
    setTambonOptions([]);
  };

  const handleAmphureChange = (amphureName: string) => {
    form.setValue("district", amphureName);
    form.setValue("subDistrict", "");
    form.setValue("postalCode", "");
    const amphure = amphureOptions.find((a) => a.name === amphureName);
    setTambonOptions(amphure ? amphure.tambon : []);
  };

  const handleTambonChange = (tambonName: string) => {
    form.setValue("subDistrict", tambonName);
    const tambon = tambonOptions.find((t) => t.name === tambonName);
    if (tambon) form.setValue("postalCode", tambon.zipCode);
  };

  const onSubmit = async (data: DependentRegisterInput) => {
    if (!dependentId) {
        toast.error("ไม่พบ ID ผู้สูงอายุ (กรุณาลงทะเบียนก่อนแก้ไข)");
        return;
    }
    setIsLoading(true);
    try {
      // ✅ แก้ไข 2: ส่งเบอร์ไปตรงๆ ไม่ต้องเติม +66
      const submitData = {
        ...data,
      };

      const res = await updateDependentProfile(dependentId, submitData);

      if (res.success) {
        toast.success("บันทึกข้อมูลเรียบร้อย!");
      } else {
        toast.error(res.error || "บันทึกไม่สำเร็จ");
      }
    } catch (e) {
      toast.error("เกิดข้อผิดพลาดที่ไม่คาดคิด");
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  if (!liffReady)
    return (
      <div className="h-screen flex items-center justify-center bg-orange-50">
        <Loader2 className="animate-spin text-orange-500 w-10 h-10" />
      </div>
    );

  return (
    <div className="min-h-screen bg-orange-50 pb-10 font-sans">
      {/* Header */}
      <div className="relative bg-white pb-10 rounded-b-[2.5rem] shadow-lg overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-orange-50 to-white pointer-events-none" />

        <div className="relative z-10 pt-10 px-6 text-center">
          <div className="mx-auto w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mb-3 shadow-sm border border-orange-200">
            <Heart
              className="w-8 h-8 text-orange-500"
              fill="currentColor"
              fillOpacity={0.2}
            />
          </div>
          <h1 className="text-2xl font-black text-slate-800 mb-1 tracking-tight">
            แก้ไขข้อมูลผู้สูงอายุ
          </h1>
          <p className="text-slate-500 text-sm font-medium">
            อัปเดตข้อมูลผู้ที่อยู่ในความดูแลของท่าน
          </p>
        </div>
      </div>

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="px-5 -mt-6 relative z-20 max-w-lg mx-auto space-y-6"
      >
        {/* ข้อมูลส่วนตัว */}
        <div className="bg-white p-6 rounded-3xl shadow-xl shadow-orange-900/5 border border-white/50">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-600">
              <User className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">ข้อมูลส่วนตัว</h2>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                  ชื่อ
                </label>
                <input
                  {...form.register("firstName")}
                  className="w-full px-4 py-3 bg-slate-50 rounded-2xl border-0 focus:ring-2 focus:ring-orange-500/20 transition-all font-bold text-slate-700 placeholder:text-slate-300"
                  placeholder="ระบุชื่อ"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                  นามสกุล
                </label>
                <input
                  {...form.register("lastName")}
                  className="w-full px-4 py-3 bg-slate-50 rounded-2xl border-0 focus:ring-2 focus:ring-orange-500/20 transition-all font-bold text-slate-700 placeholder:text-slate-300"
                  placeholder="ระบุนามสกุล"
                />
              </div>
            </div>

            <div className="space-y-1.5 mb-4">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                รหัส PIN (สำหรับเชื่อมต่อนาฬิกา){" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                maxLength={4}
                {...form.register("pin")}
                className="w-full px-4 py-3 bg-slate-50 rounded-2xl border-0 focus:ring-2 focus:ring-orange-500/20 transition-all font-bold text-slate-700 tracking-[0.5em] text-center text-xl placeholder:tracking-normal placeholder:text-sm placeholder:font-normal"
                placeholder="ตั้งรหัส 4 หลัก"
              />
              {form.formState.errors.pin && (
                <p className="text-xs text-red-500 ml-1">
                  {form.formState.errors.pin.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                วันเดือนปีเกิด
              </label>
              <div className="relative">
                <input
                  type="date"
                  {...form.register("birthday")}
                  className="w-full px-4 py-3 bg-slate-50 rounded-2xl border-0 font-medium text-slate-600 focus:ring-2 focus:ring-orange-500/20"
                />
                <Calendar className="absolute right-4 top-3.5 w-5 h-5 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                  เพศ
                </label>
                <div className="relative">
                  <select
                    {...form.register("gender")}
                    className="w-full px-4 py-3 bg-slate-50 rounded-2xl border-0 font-medium text-slate-600 appearance-none"
                  >
                    <option value="MALE">ชาย</option>
                    <option value="FEMALE">หญิง</option>
                    <option value="UNSPECIFIED">ไม่ระบุ</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                  สถานะสมรส
                </label>
                <div className="relative">
                  <select
                    {...form.register("marital")}
                    className="w-full px-4 py-3 bg-slate-50 rounded-2xl border-0 font-medium text-slate-600 appearance-none"
                  >
                    <option value="SINGLE">โสด</option>
                    <option value="MARRIED">สมรส</option>
                    <option value="WIDOWED">หม้าย</option>
                    <option value="DIVORCED">หย่าร้าง</option>
                    <option value="SEPARATED">แยกกันอยู่</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="bg-white p-6 rounded-3xl shadow-xl shadow-orange-900/5 border border-white/50">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-2xl bg-green-50 flex items-center justify-center text-green-600">
              <MapPin className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">
              ที่อยู่ปัจจุบัน
            </h2>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                  บ้านเลขที่
                </label>
                <input
                  {...form.register("houseNumber")}
                  className="w-full px-4 py-3 bg-slate-50 rounded-2xl border-0 focus:ring-2 focus:ring-green-500/20 transition-all font-medium text-slate-700"
                  placeholder="123/45"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                  หมู่ที่
                </label>
                <input
                  {...form.register("village")}
                  className="w-full px-4 py-3 bg-slate-50 rounded-2xl border-0 focus:ring-2 focus:ring-green-500/20 transition-all font-medium text-slate-700"
                  placeholder="-"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                ถนน / ซอย
              </label>
              <input
                {...form.register("road")}
                className="w-full px-4 py-3 bg-slate-50 rounded-2xl border-0 focus:ring-2 focus:ring-green-500/20 transition-all font-medium text-slate-700"
                placeholder="ชื่อถนน หรือ ซอย"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                จังหวัด
              </label>
              <div className="relative">
                <select
                  {...form.register("province")}
                  onChange={(e) => handleProvinceChange(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 rounded-2xl border-0 font-medium text-slate-700 appearance-none disabled:opacity-50"
                  disabled={isAddressLoading}
                >
                  <option value="">เลือกจังหวัด</option>
                  {allProvinces.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-3.5 w-5 h-5 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="relative">
                <select
                  {...form.register("district")}
                  onChange={(e) => handleAmphureChange(e.target.value)}
                  disabled={!form.watch("province")}
                  className="w-full px-4 py-3 bg-slate-50 rounded-2xl border-0 font-medium text-slate-700 appearance-none disabled:opacity-50"
                >
                  <option value="">อำเภอ/เขต</option>
                  {amphureOptions.map((a) => (
                    <option key={a.id} value={a.name}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-3.5 w-5 h-5 text-slate-400 pointer-events-none" />
              </div>
              <div className="relative">
                <select
                  {...form.register("subDistrict")}
                  onChange={(e) => handleTambonChange(e.target.value)}
                  disabled={!form.watch("district")}
                  className="w-full px-4 py-3 bg-slate-50 rounded-2xl border-0 font-medium text-slate-700 appearance-none disabled:opacity-50"
                >
                  <option value="">ตำบล/แขวง</option>
                  {tambonOptions.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-3.5 w-5 h-5 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                รหัสไปรษณีย์
              </label>
              <input
                {...form.register("postalCode")}
                readOnly
                className="w-full px-4 py-3 bg-slate-100 rounded-2xl border-0 font-mono font-bold text-slate-500"
              />
            </div>
          </div>
        </div>

        {/* Contact & Health */}
        <div className="bg-white p-6 rounded-3xl shadow-xl shadow-orange-900/5 border border-white/50">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600">
              <Activity className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">ข้อมูลสุขภาพ</h2>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              {/* ✅ แก้ไข 3: ปรับ UI Input ให้กรอก 0 ได้ปกติ (มีไอคอน Phone) */}
              <div className="relative">
                <div className="absolute left-4 top-3.5 flex items-center gap-2 pointer-events-none">
                  <Phone className="w-5 h-5 text-slate-400" />
                </div>
                <input
                  type="tel"
                  {...form.register("phone")}
                  // ใช้ pl-12 เพื่อเว้นที่ให้ไอคอน Phone
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-2xl border-0 focus:ring-2 focus:ring-rose-500/20 transition-all font-bold text-slate-700 tracking-wide placeholder:text-slate-300"
                  placeholder="ระบุเบอร์โทร" // placeholder 08...
                  maxLength={10}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                โรคประจำตัว
              </label>
              <textarea
                {...form.register("diseases")}
                className="w-full px-4 py-3 bg-slate-50 rounded-2xl border-0 focus:ring-2 focus:ring-rose-500/20 transition-all font-medium text-slate-700 placeholder:text-slate-300 min-h-[80px]"
                placeholder="เช่น ความดันโลหิตสูง, เบาหวาน"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                ยาที่ใช้ประจำ
              </label>
              <textarea
                {...form.register("medications")}
                className="w-full px-4 py-3 bg-slate-50 rounded-2xl border-0 focus:ring-2 focus:ring-rose-500/20 transition-all font-medium text-slate-700 placeholder:text-slate-300 min-h-[80px]"
                placeholder="ระบุชื่อยาที่ทานประจำ (ถ้ามี)"
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold text-lg rounded-2xl shadow-lg shadow-orange-500/30 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:scale-100 hover:shadow-xl"
        >
          {isLoading ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Save className="w-5 h-5" />
          )}
          {isLoading ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
        </button>
      </form>
    </div>
  );
}