'use client';

import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Save, Loader2, Trash2, Upload, FileJson, X } from 'lucide-react';
import { toast } from 'sonner';
import { addEquipment, updateEquipment, addBulkEquipment } from '@/actions/equipment.actions';
import { Switch } from '@/components/ui/switch';

interface EquipmentDialogProps {
  mode?: 'create' | 'edit';
  initialData?: any;
  trigger?: React.ReactNode;
}

export function EquipmentDialog({ mode = 'create', initialData, trigger }: EquipmentDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // State สำหรับโหมด Create แบบ Vercel Style
  const [entries, setEntries] = useState([{ name: '', code: '' }]);
  const [importMode, setImportMode] = useState<'manual' | 'json'>('manual');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Logic สำหรับจัดการแถว (Vercel Style) ---
  const handleAddRow = () => {
    setEntries([...entries, { name: '', code: '' }]);
  };

  const handleRemoveRow = (index: number) => {
    const newEntries = [...entries];
    newEntries.splice(index, 1);
    setEntries(newEntries);
  };

  const handleInputChange = (index: number, field: 'name' | 'code', value: string) => {
    const newEntries = [...entries];
    newEntries[index][field] = value;
    setEntries(newEntries);
    
    // Auto add row: ถ้ากรอกแถวสุดท้ายจนครบ ให้เพิ่มแถวใหม่ให้อัตโนมัติ (เหมือน Vercel)
    if (index === entries.length - 1 && newEntries[index].name && newEntries[index].code) {
        handleAddRow();
    }
  };

  // --- Logic สำหรับ JSON File ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const json = JSON.parse(event.target?.result as string);
            if (Array.isArray(json)) {
                // Map ข้อมูลให้ตรง structure
                const mappedEntries = json.map((item: any) => ({
                    name: item.name || item.equipmentName || '',
                    code: item.code || item.serialNumber || ''
                })).filter(item => item.name && item.code); // เอาเฉพาะที่มีข้อมูลครบ

                if (mappedEntries.length > 0) {
                    setEntries(mappedEntries);
                    setImportMode('manual'); // กลับไปหน้า Manual เพื่อให้ user ตรวจสอบก่อน save
                    toast.success(`นำเข้าข้อมูล ${mappedEntries.length} รายการเรียบร้อย`);
                } else {
                    toast.error("ไม่พบข้อมูลที่ถูกต้องในไฟล์ JSON");
                }
            }
        } catch (error) {
            toast.error("ไฟล์ JSON ไม่ถูกต้อง");
        }
    };
    reader.readAsText(file);
    // Reset file input value เพื่อให้เลือกไฟล์เดิมซ้ำได้ถ้าต้องการ
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- Submit Logic ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
        if (mode === 'edit') {
             // 1. Logic เดิมสำหรับ Edit (ทีละรายการ)
             const formData = new FormData(e.target as HTMLFormElement);
             const data = {
                 name: formData.get('name') as string,
                 code: formData.get('code') as string,
                 isActive: formData.get('isActive') === 'on'
             };
             const res = await updateEquipment(initialData.id, data);
             if (!res.success) throw new Error(res.error);
        } else {
            // 2. Logic ใหม่สำหรับ Create (Bulk)
            // กรองเอาแถวที่ว่างๆ ออก
            const validEntries = entries.filter(e => e.name.trim() !== '' && e.code.trim() !== '');
            
            if (validEntries.length === 0) {
                toast.error("กรุณากรอกข้อมูลอย่างน้อย 1 รายการ");
                setLoading(false);
                return;
            }

            // เรียก API ทีเดียว (แนะนำวิธีนี้)
            const res = await addBulkEquipment(validEntries);
            
            // หรือถ้านายน้อยยังไม่ได้แก้ Backend ให้ใช้วิธี Loop ยิง (แต่ช้ากว่านะ)
            /* for (const entry of validEntries) {
                await addEquipment({ ...entry, isActive: true });
            } 
            */

            if (!res.success) throw new Error(res.error);
        }

        toast.success(mode === 'create' ? "บันทึกข้อมูลเรียบร้อย" : "แก้ไขข้อมูลเรียบร้อย");
        setOpen(false);
        setEntries([{ name: '', code: '' }]); // Reset form

    } catch (error: any) {
        toast.error(error.message || "เกิดข้อผิดพลาด");
    } finally {
        setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ? trigger : (
            <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                <Plus className="w-4 h-4 mr-2"/> เพิ่มอุปกรณ์ใหม่
            </Button>
        )}
      </DialogTrigger>
      <DialogContent className={mode === 'create' ? "max-w-2xl" : "max-w-md"}>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'เพิ่มอุปกรณ์เข้าคลัง' : 'แก้ไขข้อมูลอุปกรณ์'}</DialogTitle>
        </DialogHeader>

        {/* ---------------- CREATE MODE (VERCEL STYLE) ---------------- */}
        {mode === 'create' ? (
            <div className="space-y-4">
                {/* Tabs เปลี่ยนโหมด */}
                <div className="flex items-center gap-2 border-b pb-2">
                    <button 
                        onClick={() => setImportMode('manual')}
                        className={`text-sm px-3 py-1.5 rounded-md transition-all ${importMode === 'manual' ? 'bg-gray-100 font-bold text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        กรอกข้อมูลเอง
                    </button>
                    <button 
                         onClick={() => fileInputRef.current?.click()}
                         className={`text-sm px-3 py-1.5 rounded-md transition-all flex items-center gap-1 text-gray-500 hover:text-gray-700 hover:bg-gray-50`}
                    >
                        <Upload className="w-3 h-3" /> นำเข้า JSON
                        <input 
                            type="file" 
                            accept=".json" 
                            ref={fileInputRef} 
                            className="hidden" 
                            onChange={handleFileUpload}
                        />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="mt-2">
                    <div className="rounded-lg border bg-gray-50/50 p-1">
                        {/* Header ของตาราง */}
                        <div className="grid grid-cols-12 gap-3 px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <div className="col-span-5">ชื่อรุ่น / อุปกรณ์</div>
                            <div className="col-span-6">รหัสครุภัณฑ์</div>
                            <div className="col-span-1"></div>
                        </div>

                        {/* พื้นที่ Scrollable */}
                        <div className="max-h-[300px] overflow-y-auto space-y-2 px-1 pb-1 scrollbar-thin scrollbar-thumb-gray-200">
                            {entries.map((entry, index) => (
                                <div key={index} className="grid grid-cols-12 gap-3 items-center group">
                                    <div className="col-span-5 mt-2">
                                        <Input 
                                            value={entry.name}
                                            onChange={(e) => handleInputChange(index, 'name', e.target.value)}
                                            className="bg-white font-mono text-sm"
                                        />
                                    </div>
                                    <div className="col-span-6 mt-2">
                                        <Input 
                                            value={entry.code}
                                            onChange={(e) => handleInputChange(index, 'code', e.target.value)}
                                            className="bg-white font-mono text-sm"
                                        />
                                    </div>
                                    <div className="col-span-1 flex justify-center">
                                        {/* ปุ่มลบจะโชว์เฉพาะถ้ามีมากกว่า 1 แถว หรือไม่ใช่แถวสุดท้ายที่ว่างเปล่า */}
                                        {(entries.length > 1) && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => handleRemoveRow(index)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-4 flex justify-between items-center">
                        <Button type="button" variant="outline" onClick={handleAddRow} className="text-gray-600">
                            <Plus className="w-4 h-4 mr-2" /> เพิ่มแถว
                        </Button>
                        <Button type="submit" className="bg-blue-600 hover:bg-blue-700 min-w-[120px]" disabled={loading}>
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                            บันทึกทั้งหมด ({entries.filter(e => e.name && e.code).length})
                        </Button>
                    </div>
                </form>
            </div>
        ) : (
        /* ---------------- EDIT MODE (แบบเดิม) ---------------- */
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-2">
                <Label>ชื่อรุ่น / ชื่ออุปกรณ์ <span className="text-red-500">*</span></Label>
                <Input name="name" required placeholder="เช่น Samsung Galaxy Watch 4" defaultValue={initialData?.name} />
            </div>
            
            <div className="space-y-2">
                <Label>รหัสครุภัณฑ์ / Serial Number <span className="text-red-500">*</span></Label>
                <Input name="code" required placeholder="เช่น SW-2024-001" defaultValue={initialData?.code} />
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                <Label>สถานะการใช้งาน</Label>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{initialData?.isActive ? 'พร้อมใช้งาน' : 'ส่งซ่อม/เลิกใช้'}</span>
                    <Switch name="isActive" defaultChecked={initialData?.isActive} />
                </div>
            </div>

            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                บันทึกการแก้ไข
            </Button>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}