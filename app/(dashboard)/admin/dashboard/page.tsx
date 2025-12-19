import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import StatsCard from "@/components/features/dashboard/stats-card";
import ChartSection from "@/components/features/dashboard/chart-section";
import AlertFunnel from "@/components/features/dashboard/alert-funnel";
import { Users, Activity, ShieldAlert } from "lucide-react";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfDay,
  endOfDay
} from "date-fns";
import { th } from "date-fns/locale";

export const dynamic = "force-dynamic";

// --- Helper Functions ---

async function getAdminProfile(session: any) {
  return session
    ? await prisma.adminProfile.findUnique({ where: { userId: session.userId } })
    : null;
}

// 🧠 ฟังก์ชันช่วยนับเหตุการณ์ (จับกลุ่มเวลาถ้าห่างกันไม่เกิน 20 นาที)
// ใช้สำหรับกรองข้อมูลที่ส่งมาถี่ๆ ให้นับเป็น 1 เหตุการณ์
const countDistinctEvents = (records: any[]) => {
    if (!records || records.length === 0) return 0;
    
    // 1. เรียงข้อมูลตามเวลา
    const sorted = [...records].sort((a, b) => {
        const timeA = new Date(a.timestamp || a.requestedAt).getTime();
        const timeB = new Date(b.timestamp || b.requestedAt).getTime();
        return timeA - timeB;
    });

    let eventCount = 1;
    let lastTime = new Date(sorted[0].timestamp || sorted[0].requestedAt).getTime();

    for (let i = 1; i < sorted.length; i++) {
        const currentTime = new Date(sorted[i].timestamp || sorted[i].requestedAt).getTime();
        const diffMinutes = (currentTime - lastTime) / (1000 * 60);

        // 2. ถ้าห่างกันเกิน 20 นาที -> นับเป็นเหตุการณ์ใหม่
        if (diffMinutes > 20) {
            eventCount++;
            lastTime = currentTime;
        }
    }
    return eventCount;
};

// --- Data Fetching ---

// 🔥 1. ดึงข้อมูลกราฟเส้น/พื้นที่ (Timeline)
async function getChartData() {
  const now = new Date();
  const startOfThisMonth = startOfMonth(now);
  const startOfThisWeek = startOfWeek(now, { weekStartsOn: 1 });
  const fetchStartDate = startOfThisMonth < startOfThisWeek ? startOfThisMonth : startOfThisWeek;

  const [falls, sos, heartRaw, tempRaw, zoneRaw] = await Promise.all([
    prisma.fallRecord.findMany({ 
        where: { timestamp: { gte: fetchStartDate } }, 
        select: { timestamp: true } 
    }),
    prisma.extendedHelp.findMany({ 
        where: { requestedAt: { gte: fetchStartDate } }, 
        select: { requestedAt: true } 
    }),
    prisma.heartRateRecord.findMany({ 
        where: { timestamp: { gte: fetchStartDate }, status: 'ABNORMAL' }, 
        select: { timestamp: true },
        orderBy: { timestamp: 'asc' }
    }),
    prisma.temperatureRecord.findMany({ 
        where: { timestamp: { gte: fetchStartDate }, status: 'ABNORMAL' }, 
        select: { timestamp: true },
        orderBy: { timestamp: 'asc' }
    }),
    prisma.location.findMany({ 
        where: { timestamp: { gte: fetchStartDate }, status: 'DANGER' }, 
        select: { timestamp: true },
        orderBy: { timestamp: 'asc' }
    }),
  ]);

  // ใช้ Logic Grouping ในการนับจำนวนกราฟด้วย
  // (เพื่อให้กราฟเส้นไม่โดดสูงเกินจริง)
  const groupAndCount = (items: any[], start: Date, end: Date) => {
      const filtered = items.filter((i) => {
          const t = new Date(i.timestamp || i.requestedAt);
          return t >= start && t < end;
      });
      return countDistinctEvents(filtered);
  };

  // 1. Hourly Today
  const dayData = [];
  const startOfToday = startOfDay(now);
  for (let i = 0; i < 24; i++) {
    const start = new Date(startOfToday); start.setHours(i);
    const end = new Date(startOfToday); end.setHours(i + 1);
    if (start <= now) {
        dayData.push({ 
            name: format(start, "HH:mm"), 
            falls: groupAndCount(falls, start, end), 
            sos: groupAndCount(sos, start, end),
            heart: groupAndCount(heartRaw, start, end),
            temp: groupAndCount(tempRaw, start, end),
            zone: groupAndCount(zoneRaw, start, end)
        });
    }
  }

  // 2. Daily This Week
  const weekData = [];
  const weekInterval = eachDayOfInterval({ start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) });
  for (const d of weekInterval) {
    const start = startOfDay(d);
    const end = endOfDay(d);
    weekData.push({ 
        name: format(d, "EEE", { locale: th }), 
        falls: groupAndCount(falls, start, end), 
        sos: groupAndCount(sos, start, end),
        heart: groupAndCount(heartRaw, start, end),
        temp: groupAndCount(tempRaw, start, end),
        zone: groupAndCount(zoneRaw, start, end)
    });
  }

  // 3. Daily This Month
  const monthData = [];
  const monthInterval = eachDayOfInterval({ start: startOfMonth(now), end: endOfMonth(now) });
  for (const d of monthInterval) {
    const start = startOfDay(d);
    const end = endOfDay(d);
    monthData.push({ 
        name: format(d, "d"), 
        falls: groupAndCount(falls, start, end), 
        sos: groupAndCount(sos, start, end),
        heart: groupAndCount(heartRaw, start, end),
        temp: groupAndCount(tempRaw, start, end),
        zone: groupAndCount(zoneRaw, start, end)
    });
  }

  return { day: dayData, week: weekData, month: monthData };
}

// 🔥 2. ฟังก์ชันดึงข้อมูลกราฟเปรียบเทียบ (Total vs Critical)
// ✅ แก้ไข: ใส่ตัวกรองวันที่ + นับแบบ Event Grouping
async function getComparisonData() {
    // กำหนดช่วงเวลา (เอาเฉพาะข้อมูลปัจจุบัน ไม่เอา All Time)
    const now = new Date();
    const startOfThisMonth = startOfMonth(now);
    const startOfThisWeek = startOfWeek(now, { weekStartsOn: 1 });
    // ใช้ตัวแปรเดียวกับ Chart เพื่อความสอดคล้อง
    const fetchStartDate = startOfThisMonth < startOfThisWeek ? startOfThisMonth : startOfThisWeek;

    const [
        falls, 
        sos, 
        heartTotal, heartAbnormal,
        tempTotal, tempAbnormal,
        zoneTotal, zoneAbnormal
    ] = await Promise.all([
        // Fall
        prisma.fallRecord.findMany({ 
            where: { timestamp: { gte: fetchStartDate } }, // ✅ กรองวันที่
            select: { timestamp: true } 
        }),
        // SOS
        prisma.extendedHelp.findMany({ 
            where: { requestedAt: { gte: fetchStartDate } }, // ✅ กรองวันที่
            select: { requestedAt: true } 
        }),
        
        // Heart
        prisma.heartRateRecord.findMany({ 
            where: { timestamp: { gte: fetchStartDate } }, // ✅ กรองวันที่
            select: { timestamp: true } 
        }),
        prisma.heartRateRecord.findMany({ 
            where: { timestamp: { gte: fetchStartDate }, status: 'ABNORMAL' }, 
            select: { timestamp: true } 
        }),
        
        // Temp
        prisma.temperatureRecord.findMany({ 
            where: { timestamp: { gte: fetchStartDate } }, // ✅ กรองวันที่
            select: { timestamp: true } 
        }),
        prisma.temperatureRecord.findMany({ 
            where: { timestamp: { gte: fetchStartDate }, status: 'ABNORMAL' }, 
            select: { timestamp: true } 
        }),
        
        // Zone
        prisma.location.findMany({ 
            where: { timestamp: { gte: fetchStartDate } }, // ✅ กรองวันที่
            select: { timestamp: true } 
        }),
        prisma.location.findMany({ 
            where: { timestamp: { gte: fetchStartDate }, status: 'DANGER' }, 
            select: { timestamp: true } 
        }),
    ]);

    return [
        { 
            name: "การล้ม", 
            total: falls.length, 
            critical: falls.length, // Fall ปกติไม่ถี่ นับตามจริงได้
            fill: "#F97316" // Neon Orange
        },
        { 
            name: "SOS", 
            total: sos.length, 
            critical: sos.length, // SOS ปกติไม่ถี่ นับตามจริงได้
            fill: "#EF4444" // Neon Red
        },
        { 
            name: "หัวใจ", 
            total: heartTotal.length, 
            critical: countDistinctEvents(heartAbnormal), // ✅ ใช้ Grouping ลดจำนวน
            fill: "#F500FF" // Neon Pink
        },
        { 
            name: "อุณหภูมิ", 
            total: tempTotal.length, 
            critical: countDistinctEvents(tempAbnormal), // ✅ ใช้ Grouping ลดจำนวน
            fill: "#FFD600" // Neon Yellow
        },
        { 
            name: "โซน", 
            total: zoneTotal.length, 
            critical: countDistinctEvents(zoneAbnormal), // ✅ ใช้ Grouping ลดจำนวน
            fill: "#00E5FF" // Neon Cyan
        },
    ];
}

// --- Main Page Component ---
export default async function DashboardPage() {
  const session = await getSession();
  
  const adminProfile = await getAdminProfile(session);
  const adminName = adminProfile
    ? `${adminProfile.firstName} ${adminProfile.lastName}`
    : "Administrator";
  
  const [
    totalDependents,
    todayFallsCount,
    ackFallsCount,
    activeDevices,
    chartData,
    comparisonData
  ] = await Promise.all([
    prisma.dependentProfile.count(),
    prisma.fallRecord.count({ where: { timestamp: { gte: new Date(new Date().setHours(0,0,0,0)) } } }),
    prisma.fallRecord.count({ 
        where: { 
            timestamp: { gte: new Date(new Date().setHours(0,0,0,0)) },
            status: 'ACKNOWLEDGED' 
        } 
    }), 
    // นับอุปกรณ์ที่มีการส่ง Location มาใน 1 ชม. ล่าสุด
    prisma.location.groupBy({ by: ['dependentId'], where: { timestamp: { gte: new Date(Date.now() - 60 * 60 * 1000) } } }).then(res => res.length),
    getChartData(),
    getComparisonData()
  ]);

  const funnelData = {
    detected: todayFallsCount,
    acknowledged: ackFallsCount,
    resolved: ackFallsCount > 0 ? ackFallsCount : 0 
  };

  return (
    <div className="h-[calc(100vh-138px)] w-full bg-slate-50 p-3 overflow-hidden">
      <div className="grid grid-cols-12 gap-3 h-full">
        
        {/* 🟡 ส่วนซ้าย (9 ส่วน) - กราฟหลัก */}
        <div className="col-span-12 lg:col-span-9 h-full">
            <ChartSection 
                overviewData={chartData} 
                comparisonData={comparisonData} 
                adminName={adminName} 
            />
        </div>

        {/* 🟡 ส่วนขวา (3 ส่วน) - Stats & Funnel */}
        <div className="col-span-12 lg:col-span-3 h-full flex flex-col gap-3">
            
            <div className="h-[90px] shrink-0">
                <StatsCard
                    title="อุปกรณ์ออนไลน์"
                    value={activeDevices}
                    icon={Activity}
                    color="emerald"
                    trend="up"
                />
            </div>

            <div className="h-[90px] shrink-0">
                <StatsCard
                    title="ผู้ที่มีภาวะพึ่งพิง"
                    value={totalDependents}
                    icon={Users}
                    color="blue"
                    trend="neutral"
                />
            </div>

            <div className="h-[90px] shrink-0">
                <StatsCard
                    title="แจ้งเตือนวันนี้"
                    value={todayFallsCount}
                    icon={ShieldAlert}
                    color="orange"
                    trend={todayFallsCount > 0 ? "down" : "neutral"}
                />
            </div>
            
            <div className="flex-1 min-h-0">
                 <AlertFunnel data={funnelData} />
            </div>
            
        </div>
      </div>
    </div>
  );
}