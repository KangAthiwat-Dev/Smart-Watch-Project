import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getEquipments } from '@/actions/equipment.actions';
import { EquipmentTable } from '@/components/features/equipment/equipment-table';
import { EquipmentDialog } from '@/components/features/equipment/equipment-dialog';
import { Package } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function EquipmentPage() {
  const res = await getEquipments();
  const equipments = res.success ? res.data : [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold text-gray-900">จัดการอุปกรณ์</h1>
            <p className="text-gray-600 mt-1">เพิ่ม/ลด และตรวจสอบสถานะครุภัณฑ์</p>
        </div>
        {/* ปุ่มเพิ่ม (Modal) */}
        <EquipmentDialog mode="create" />
      </div>
      
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className=" bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            <CardTitle>รายการอุปกรณ์ทั้งหมด ({equipments?.length || 0})</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <EquipmentTable data={equipments || []} />
        </CardContent>
      </Card>
    </div>
  );
}