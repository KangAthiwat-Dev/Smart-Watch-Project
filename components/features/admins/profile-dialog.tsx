'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Lock, Save, Loader2, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { updateAdminProfile, getAdminProfile } from '@/actions/admin.actions';

export function ProfileDialog({ userId, trigger, onUpdateSuccess }: { userId: number, trigger: React.ReactNode, onUpdateSuccess: (newData: any) => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
      firstName: '', lastName: '', phone: '', position: '', username: '', image: ''
  });
  const [passwords, setPasswords] = useState({ newPassword: '', confirmPassword: '' });
  
  // ✅ 1. เพิ่ม Ref เพื่อไปสั่งกด Input ที่ซ่อนอยู่
  const fileInputRef = useRef<HTMLInputElement>(null);

  // โหลดข้อมูลล่าสุดเมื่อเปิด Dialog
  useEffect(() => {
      if (open && userId) {
          getAdminProfile(userId).then(res => {
              if (res) setData({ 
                  firstName: res.firstName, 
                  lastName: res.lastName, 
                  phone: res.phone || '', 
                  position: res.position || '', 
                  username: res.username,
                  image: res.image || ''
              });
          });
      }
  }, [open, userId]);

  // ✅ 2. ฟังก์ชันจัดการเมื่อเลือกไฟล์รูป
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // เช็คขนาดไฟล์ (กันไฟล์ใหญ่เกิน 2MB เดี๋ยว Database บวม)
      if (file.size > 2 * 1024 * 1024) {
          return toast.error("ขนาดไฟล์รูปภาพต้องไม่เกิน 2MB");
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        // แปลงเป็น Base64 แล้วเซ็ตลง State เพื่อโชว์และบันทึก
        setData(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwords.newPassword && passwords.newPassword !== passwords.confirmPassword) {
        return toast.error("รหัสผ่านใหม่ไม่ตรงกัน");
    }

    setLoading(true);
    const res = await updateAdminProfile(userId, { ...data, newPassword: passwords.newPassword });

    if (res.success) {
        toast.success("บันทึกข้อมูลส่วนตัวเรียบร้อย");
        setOpen(false);
        setPasswords({ newPassword: '', confirmPassword: '' });
        onUpdateSuccess({ firstName: data.firstName, lastName: data.lastName });
    } else {
        toast.error(res.error);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>แก้ไขข้อมูลส่วนตัว</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
            <Tabs defaultValue="general" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="general">ข้อมูลทั่วไป</TabsTrigger>
                    <TabsTrigger value="security">ความปลอดภัย</TabsTrigger>
                </TabsList>

                {/* --- Tab 1: ข้อมูลทั่วไป --- */}
                <TabsContent value="general" className="space-y-4">
                    {/* Profile Image Section */}
                    <div className="flex flex-col items-center gap-2 mb-4">
                        <div 
                            // ✅ 3. สั่งให้คลิก div นี้แล้วไปกระตุ้น input
                            onClick={() => fileInputRef.current?.click()}
                            className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center relative overflow-hidden group cursor-pointer border-4 border-white shadow-md hover:shadow-lg transition-all"
                        >
                            {/* แสดงรูป (ถ้ามี) หรือ Default Icon */}
                            {data.image ? (
                                <img src={data.image} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <User className="w-10 h-10 text-slate-400" />
                            )}

                            {/* Overlay ตอนเอาเมาส์ชี้ */}
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Camera className="w-6 h-6 text-white" />
                            </div>
                        </div>
                        
                        <span className="text-xs text-gray-400">คลิกที่รูปเพื่อเปลี่ยนแปลง</span>
                        
                        {/* ✅ 4. Input File ที่ซ่อนไว้ */}
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept="image/*" 
                            onChange={handleImageChange}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label>ชื่อจริง</Label>
                            <Input value={data.firstName} onChange={e => setData({...data, firstName: e.target.value})} required />
                        </div>
                        <div className="space-y-2">
                            <Label>นามสกุล</Label>
                            <Input value={data.lastName} onChange={e => setData({...data, lastName: e.target.value})} required />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>ตำแหน่งงาน</Label>
                        <Input value={data.position} placeholder="เช่น ผู้ดูแลระบบ, เจ้าหน้าที่ IT" onChange={e => setData({...data, position: e.target.value})} />
                    </div>

                    <div className="space-y-2">
                        <Label>เบอร์โทรศัพท์</Label>
                        <Input value={data.phone} placeholder="08xxxxxxxx" onChange={e => setData({...data, phone: e.target.value})} />
                    </div>
                </TabsContent>

                {/* --- Tab 2: ความปลอดภัย --- */}
                <TabsContent value="security" className="space-y-4">
                    <div className="p-3 bg-yellow-50 text-yellow-700 text-xs rounded-lg border border-yellow-200 mb-2">
                        ⚠️ ปล่อยว่างไว้หากไม่ต้องการเปลี่ยนรหัสผ่าน
                    </div>

                    <div className="space-y-2">
                        <Label>Username</Label>
                        <Input value={data.username} onChange={e => setData({...data, username: e.target.value})} required />
                    </div>

                    <div className="space-y-2 relative">
                        <Label>รหัสผ่านใหม่</Label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                            <Input type="password" className="pl-9" placeholder="••••••••" value={passwords.newPassword} onChange={e => setPasswords({...passwords, newPassword: e.target.value})} />
                        </div>
                    </div>

                    <div className="space-y-2 relative">
                        <Label>ยืนยันรหัสผ่านใหม่</Label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                            <Input type="password" className="pl-9" placeholder="••••••••" value={passwords.confirmPassword} onChange={e => setPasswords({...passwords, confirmPassword: e.target.value})} />
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            <div className="mt-6 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    บันทึกข้อมูล
                </Button>
            </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}