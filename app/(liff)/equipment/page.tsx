import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import { 
  History, 
  Watch, 
  AlertCircle, 
  Clock, 
  PackageOpen,
  User
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { cookies } from "next/headers";
import LiffGuard from "@/components/auth/liff-guard";

export const dynamic = "force-dynamic";

export default async function EquipmentMenuPage() {
  // 2. ดึง User ID จาก Cookie (ระบบ Login ต้องฝัง cookie ชื่อ 'userId' มาให้แล้ว)
  const cookieStore = await cookies();
  const userIdStr = cookieStore.get("userId")?.value;

  if (!userIdStr) {
    return (
      <LiffGuard>
         {/* ใส่ div ว่างๆ ไว้ เพราะเดี๋ยว LiffGuard จะสั่ง reload หน้าจอเองเมื่อ Login เสร็จ */}
         <div className="min-h-screen bg-white"></div> 
      </LiffGuard>
    );
  }

  const userId = parseInt(userIdStr);

  // 3. ใช้ userId จริงในการ Query
  const caregiver = await prisma.caregiverProfile.findFirst({
    where: { userId: userId }, 
    include: {
      dependents: {
        include: {
          borrowRequests: { 
            orderBy: { createdAt: 'desc' },
            include: { 
                items: { include: { equipment: true } },
                history: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            } 
          }
        }
      }
    }
  });

  if (!caregiver) {
    return <div className="p-6 text-center text-red-500">ไม่พบข้อมูลผู้ดูแล (User ID: {userId})</div>;
  }

  const allHistory = caregiver.dependents.flatMap(dep => 
    dep.borrowRequests.map(req => {
        const latestHistory = req.history[0];
        const reason = latestHistory?.action === 'REJECT' ? latestHistory.reason : null;

        return {
            ...req,
            dependentName: `${dep.firstName} ${dep.lastName}`,
            rejectReason: reason
        };
    })
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING': return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-yellow-200">รออนุมัติ</Badge>;
      case 'APPROVED': return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">อนุมัติ</Badge>;
      case 'REJECTED': return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200">ไม่อนุมัติ</Badge>;
      case 'RETURN_PENDING': return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-orange-200">รอตรวจสอบคืน</Badge>;
      case 'RETURNED': return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 border-slate-200">คืนแล้ว</Badge>;
      case 'RETURN_FAILED': return <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-rose-200">คืนไม่ผ่าน</Badge>;
      default: return <Badge variant="default">ไม่ระบุ</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      
      {/* Header */}
      <div className="bg-white p-6 shadow-sm border-b sticky top-0 z-10 rounded-bl-3xl rounded-br-3xl">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <PackageOpen className="w-6 h-6 text-blue-600" />
          บริการยืม-คืนอุปกรณ์
        </h1>
        <p className="text-sm text-slate-500 mt-1">จัดการอุปกรณ์สำหรับผู้ที่มีภาวะพึ่งพิงในความดูแล</p>
      </div>

      <div className="p-4 space-y-6">
        
        {/* Section 1: รายชื่อผู้ที่มีภาวะพึ่งพิง */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider ml-1">
            รายการผู้ที่มีภาวะพึ่งพิง ({caregiver.dependents.length})
          </h2>

          {caregiver.dependents.map((dep) => {
            const latestRequest = dep.borrowRequests[0];
            
            const status = latestRequest?.status; 
            const equipmentName = latestRequest?.items[0]?.equipment?.name;
            
            const latestHistory = latestRequest?.history?.[0];
            const rejectReason = latestHistory?.action === 'REJECT' ? latestHistory.reason : null;

            let actionButton = null;

            if (!status || status === 'RETURNED' || status === 'REJECTED') {
              actionButton = (
                <Link href={`/equipment/borrow?dependentId=${dep.id}`} className="w-full" prefetch={true}>
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 shadow-sm">
                    <Watch className="w-4 h-4 mr-2" /> ยืมอุปกรณ์ใหม่
                  </Button>
                </Link>
              );
            } else if (status === 'APPROVED') {
              actionButton = (
                <Link href={`/equipment/return/${latestRequest.id}`} className="w-full" prefetch={true}>
                  <Button variant="outline" className="w-full border-blue-200 text-blue-700 hover:bg-blue-50">
                    <PackageOpen className="w-4 h-4 mr-2" /> แจ้งคืนอุปกรณ์
                  </Button>
                </Link>
              );
            } else if (status === 'PENDING' || status === 'RETURN_PENDING') {
              actionButton = (
                <Button disabled className="w-full bg-slate-100 text-slate-400 border border-slate-200">
                  <Clock className="w-4 h-4 mr-2" /> อยู่ระหว่างดำเนินการ
                </Button>
              );
            } else if (status === 'RETURN_FAILED') {
               actionButton = (
                <Link href={`/equipment/return/${latestRequest.id}`} className="w-full" prefetch={true}>
                   <Button variant="destructive" className="w-full">
                     <AlertCircle className="w-4 h-4 mr-2" /> แก้ไขการคืน
                   </Button>
                </Link>
               );
            }

            return (
              <Card key={dep.id} className="border-slate-200 shadow-sm overflow-hidden">
                <CardContent className="p-0">
                  <div className="p-4 bg-white">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold border border-blue-100">
                          {dep.firstName.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800">คุณ{dep.firstName} {dep.lastName}</h3>
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <User className="w-3 h-3" /> ผู้ที่มีภาวะพึ่งพิง
                          </p>
                        </div>
                      </div>
                      {status && getStatusBadge(status)}
                    </div>

                    {(status === 'APPROVED' || status === 'PENDING' || status === 'RETURN_PENDING') && (
                        <div className="mb-4 text-sm bg-slate-50 p-2 rounded border border-slate-100 text-slate-600 flex items-center gap-2">
                            <Watch className="w-4 h-4 text-slate-400" />
                            {equipmentName || 'อุปกรณ์ติดตามตัว'}
                        </div>
                    )}

                    <div className="mt-2">
                        {actionButton}
                    </div>
                  </div>
                  
                  {status === 'REJECTED' && (
                      <div className="bg-red-50 p-3 text-xs text-red-600 border-t border-red-100 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <div>
                              <strong>ไม่อนุมัติล่าสุด:</strong> {rejectReason || 'ไม่ระบุเหตุผล'} 
                              <br/>สามารถทำรายการใหม่ได้
                          </div>
                      </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Section 2: ประวัติทั้งหมด */}
        <div className="space-y-4 pt-4 border-t border-dashed border-slate-300">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2 ml-1">
            <History className="w-4 h-4" /> ประวัติการทำรายการ
          </h2>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 divide-y divide-slate-100">
            {allHistory.length > 0 ? (
                allHistory.map((req) => (
                    <div key={req.id} className="p-4 flex justify-between items-start hover:bg-slate-50 transition-colors">
                        <div>
                            <p className="text-sm font-bold text-slate-700">{req.dependentName}</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {format(new Date(req.createdAt), 'd MMM yyyy HH:mm', { locale: th })}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                                {req.items[0]?.equipment?.name || 'อุปกรณ์ติดตาม'}
                            </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            {getStatusBadge(req.status)}
                            {req.status === 'REJECTED' && (
                                <span className="text-[10px] text-red-500">
                                    {req.rejectReason ? `เหตุผล: ${req.rejectReason}` : ''}
                                </span>
                            )}
                        </div>
                    </div>
                ))
            ) : (
                <div className="p-8 text-center text-slate-400 text-sm">
                    ยังไม่มีประวัติการทำรายการ
                </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}