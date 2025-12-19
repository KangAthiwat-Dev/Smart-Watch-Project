import { prisma } from '@/lib/db/prisma';
import MonitoringView from '@/components/features/monitoring/monitoring-view';

export const dynamic = 'force-dynamic';

interface MonitoringPageProps {
  searchParams: Promise<{ focusUser?: string }>; 
}

export default async function MonitoringPage({ searchParams }: MonitoringPageProps) {
  const { focusUser } = await searchParams; 
  
  const dependents = await prisma.dependentProfile.findMany({
    where: { 
        user: { isActive: true } 
    },
    include: {
      user: { select: { id: true, lineId: true } },
      caregiver: true,

      // Location เอาอันล่าสุดมา
      locations: { orderBy: { timestamp: 'desc' }, take: 1 },
      heartRateRecords: { orderBy: { timestamp: 'desc' }, take: 1 },
      temperatureRecords: { orderBy: { recordDate: 'desc' }, take: 1 },

      // ✅ FIX: ยังดึง Fall มาได้ แต่เราจะไม่เอาไปใช้ Trigger Map
      fallRecords: { 
          where: { status: 'DETECTED' }, 
          orderBy: { timestamp: 'desc' }, 
          take: 1 
      },
      // ✅ FIX: สำคัญที่ SOS
      receivedHelp: { 
          where: { status: { in: ['DETECTED', 'ACKNOWLEDGED'] } }, 
          orderBy: { requestedAt: 'desc' }, 
          take: 1,
      }
    }
  });

  const formattedUsers = dependents.map(dep => {
    // เราไม่สน dep.fallRecords แล้วครับ (ปล่อยเบลอไปเลยในหน้า Map)
    
    const sosRecord = dep.receivedHelp[0]; 
    const hasSOS = !!sosRecord; // เช็คว่ามี SOS ค้างอยู่ไหม?

    // ✅ FIX 1: Emergency เป็นจริง ก็ต่อเมื่อมี SOS เท่านั้น (ล้มเฉยๆ ไม่นับ)
    const isEmergency = hasSOS; 

    const latestLoc = dep.locations[0];

    // ✅ FIX 2: Privacy Filter
    // ถ้ามี SOS -> ส่งพิกัดไปให้ Map (โชว์ตัว)
    // ถ้าไม่มี SOS -> ส่ง null ไป (Map มองไม่เห็นตำแหน่ง)
    const secureLocation = (hasSOS && latestLoc) ? {
        lat: latestLoc.latitude,
        lng: latestLoc.longitude,
        battery: latestLoc.battery,
        updatedAt: latestLoc.timestamp,
        status: sosRecord.status // แสดงสถานะตาม SOS
    } : null;

    // ✅ FIX 3: Status Display
    // แสดงเฉพาะสถานะ SOS หรือ NORMAL เท่านั้น (ไม่โชว์ว่า Fall หรือ Zone Danger ถ้าเขาไม่กดเรียก)
    const displayStatus = hasSOS ? sosRecord.status : 'NORMAL';

    let rescuer = null;
    if (hasSOS && sosRecord.status === 'ACKNOWLEDGED' && sosRecord.rescuerLat && sosRecord.rescuerLng) {
        rescuer = {
            name: sosRecord.rescuerName || 'เจ้าหน้าที่',
            phone: sosRecord.rescuerPhone || '',
            lat: sosRecord.rescuerLat,
            lng: sosRecord.rescuerLng
        };
    }

    return {
        id: dep.user.id,
        firstName: dep.firstName,
        lastName: dep.lastName,
        lineId: dep.user.lineId,
        
        isEmergency: isEmergency,
        status: displayStatus, 
        // ✅ FIX 4: ลบ Type 'FALL' ออก เหลือแค่ 'SOS'
        emergencyType: hasSOS ? 'SOS' : null,

        location: secureLocation, // ✅ ส่ง Location แบบมี Privacy
        
        rescuer: rescuer,

        caregiver: dep.caregiver ? {
            firstName: dep.caregiver.firstName,
            lastName: dep.caregiver.lastName,
            phone: dep.caregiver.phone || '-'
        } : null,
        
        health: {
            bpm: dep.heartRateRecords[0]?.bpm || 0,
            temp: dep.temperatureRecords[0]?.value || 0
        }
    };
  });

  // Sort: เอาคนที่มี SOS (Emergency) ขึ้นบนสุด
  formattedUsers.sort((a, b) => {
      if (a.isEmergency !== b.isEmergency) return a.isEmergency ? -1 : 1;
      return 0; // นอกนั้นเท่าเทียมกัน
  });

  return (
    <div className="h-full flex flex-col space-y-3">
        <h1 className="text-3xl font-bold text-slate-900">ติดตามผู้ที่มีภาวะพึ่งพิง</h1>
        <MonitoringView 
            users={formattedUsers} 
            initialFocusId={focusUser ? parseInt(focusUser) : undefined} 
        />
    </div>
  );
}