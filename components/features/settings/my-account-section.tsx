'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Lock, Save, Loader2, Camera, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { updateAdminProfile } from '@/actions/admin.actions';
import Cropper from 'react-easy-crop';
import { Area } from 'react-easy-crop';

// --- Utility Functions (เหมือนเดิมเป๊ะ) ---
const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.src = url;
  });

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<string> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) return '';

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return canvas.toDataURL('image/jpeg', 0.9);
}

// ✅ รับ props user เข้ามาโดยตรง
interface MyAccountSectionProps {
    user: any; 
}

export function MyAccountSection({ user }: MyAccountSectionProps) {
  const [loading, setLoading] = useState(false);
  
  // State ข้อมูล
  const [data, setData] = useState({
      firstName: '', lastName: '', phone: '', position: '', username: '', image: ''
  });
  const [passwords, setPasswords] = useState({ newPassword: '', confirmPassword: '' });
  
  // State สำหรับ Cropper
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isCropping, setIsCropping] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ✅ โหลดข้อมูลเข้า State ทันทีที่ Component ถูก Mount
  useEffect(() => {
    if (user) {
        setData({
            firstName: user.adminProfile?.firstName || '',
            lastName: user.adminProfile?.lastName || '',
            phone: user.adminProfile?.phone || '',
            position: user.adminProfile?.position || '',
            username: user.username || '',
            image: user.adminProfile?.image || ''
        });
    }
  }, [user]);

  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImageSrc(reader.result?.toString() || '');
        setIsCropping(true);
      });
      reader.readAsDataURL(file);
    }
    e.target.value = ''; 
  };

  const showCroppedImage = async () => {
    if (imageSrc && croppedAreaPixels) {
        try {
            const croppedImageBase64 = await getCroppedImg(imageSrc, croppedAreaPixels);
            setData({ ...data, image: croppedImageBase64 });
            setIsCropping(false);
            setImageSrc(null);
        } catch (e) {
            console.error(e);
            toast.error("เกิดข้อผิดพลาดในการตัดรูป");
        }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.newPassword && passwords.newPassword !== passwords.confirmPassword) {
        return toast.error("รหัสผ่านใหม่ไม่ตรงกัน");
    }
    setLoading(true);

    // ✅ ส่ง user.id ที่รับมาจาก props
    const res = await updateAdminProfile(user.id, { ...data, newPassword: passwords.newPassword });

    if (res.success) {
        toast.success("บันทึกข้อมูลส่วนตัวเรียบร้อย");
        setPasswords({ newPassword: '', confirmPassword: '' });
        // Optional: อาจจะสั่ง window.location.reload() เพื่อให้ Header เปลี่ยนรูปตาม
    } else {
        toast.error(res.error);
    }
    setLoading(false);
  };

  // --- 🎨 ส่วนแสดงผล (Render) ---
  return (
    <div className="bg-white">
        {/* --- ✂️ หน้าจอสำหรับ Crop รูป --- */}
        {isCropping ? (
            <div className="space-y-4 border border-slate-200 p-4 rounded-xl bg-slate-50">
                <div className="relative w-full h-[300px] bg-black rounded-xl overflow-hidden shadow-inner">
                    <Cropper
                        image={imageSrc || ''}
                        crop={crop}
                        zoom={zoom}
                        aspect={1}
                        onCropChange={setCrop}
                        onCropComplete={onCropComplete}
                        onZoomChange={setZoom}
                        cropShape="round"
                        showGrid={false}
                    />
                </div>
                
                <div className="space-y-2 px-2">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>Zoom</span>
                        <span>{zoom.toFixed(1)}x</span>
                    </div>
                    <Slider 
                        value={[zoom]} 
                        min={1} 
                        max={3} 
                        step={0.1} 
                        onValueChange={(value: number[]) => setZoom(value[0])} 
                    />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => { setIsCropping(false); setImageSrc(null); }}>
                        <X className="w-4 h-4 mr-2" /> ยกเลิก
                    </Button>
                    <Button onClick={showCroppedImage} className="bg-blue-600 hover:bg-blue-700 text-white">
                        <Check className="w-4 h-4 mr-2" /> ยืนยันรูปนี้
                    </Button>
                </div>
            </div>
        ) : (
        /* --- 📝 หน้าฟอร์มปกติ --- */
        <form onSubmit={handleSubmit} className="space-y-6">
            <Tabs defaultValue="general" className="w-full">
                
                <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="general">ข้อมูลทั่วไป</TabsTrigger>
                    <TabsTrigger value="security">ความปลอดภัย</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-6 animate-in fade-in-50">
                    {/* Profile Image Preview */}
                    <div className="flex items-center gap-6">
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="w-24 h-24 bg-slate-100 rounded-full flex shrink-0 items-center justify-center relative overflow-hidden group cursor-pointer border-4 border-white shadow-md hover:shadow-lg transition-all"
                        >
                            {data.image ? (
                                <img src={data.image} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <User className="w-10 h-10 text-slate-400" />
                            )}
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Camera className="w-6 h-6 text-white" />
                            </div>
                        </div>
                        
                        <div>
                            <h3 className="font-medium text-slate-900">รูปโปรไฟล์</h3>
                            <p className="text-xs text-slate-500 mb-3">แนะนำขนาด 500x500px (ไฟล์ .jpg, .png)</p>
                            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                                อัปโหลดรูปใหม่
                            </Button>
                        </div>

                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept="image/*" 
                            onChange={handleFileChange}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                <TabsContent value="security" className="space-y-4 animate-in fade-in-50">
                    <div className="p-4 bg-yellow-50 text-yellow-800 text-sm rounded-lg border border-yellow-200 mb-4 flex gap-2">
                        <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                            <strong>เปลี่ยนรหัสผ่าน</strong>
                            <p className="text-xs mt-1 text-yellow-700">ปล่อยว่างไว้หากไม่ต้องการเปลี่ยนแปลง</p>
                        </div>
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

            <div className="pt-4 flex justify-end border-t border-slate-100">
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 min-w-[120px]" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    บันทึกการเปลี่ยนแปลง
                </Button>
            </div>
        </form>
        )}
    </div>
  );
}