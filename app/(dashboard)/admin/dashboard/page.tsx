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
import AutoRefresh from "@/components/features/dashboard/auto-refresh";

export const dynamic = "force-dynamic";

// --- Helper Functions ---

async function getAdminProfile(session: any) {
  return session
    ? await prisma.adminProfile.findUnique({ where: { userId: session.userId } })
    : null;
}

const countDistinctEvents = (records: any[]) => {
    if (!records || records.length === 0) return 0;
    return records.length;
};

// --- Data Fetching ---

async function getChartData() {
  const nowUTC = new Date();
  const nowThai = new Date(nowUTC.getTime() + (7 * 60 * 60 * 1000));

  const startOfThisMonth = startOfMonth(nowThai);
  const startOfThisWeek = startOfWeek(nowThai, { weekStartsOn: 1 });
  
  const fetchStartDate = new Date((startOfThisMonth < startOfThisWeek ? startOfThisMonth : startOfThisWeek).getTime() - (24 * 60 * 60 * 1000));

  const [falls, heartRaw, tempRaw, zoneRaw] = await Promise.all([
    prisma.fallRecord.findMany({ 
        where: { timestamp: { gte: fetchStartDate } }, 
        select: { timestamp: true } 
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

  const groupAndCount = (items: any[], start: Date, end: Date) => {
      const filtered = items.filter((i) => {
          const tUTC = new Date(i.timestamp);
          const tThai = new Date(tUTC.getTime() + (7 * 60 * 60 * 1000));
          
          return tThai >= start && tThai < end;
      });
      return countDistinctEvents(filtered);
  };

  const dayData = [];
  const startOfToday = startOfDay(nowThai); 

  for (let i = 0; i < 24; i++) {
    const start = new Date(startOfToday); start.setHours(i);
    const end = new Date(startOfToday); end.setHours(i + 1);
    
    if (start <= nowThai) {
        dayData.push({ 
            name: format(start, "HH:mm"), 
            falls: groupAndCount(falls, start, end), 
            heart: groupAndCount(heartRaw, start, end),
            temp: groupAndCount(tempRaw, start, end),
            zone: groupAndCount(zoneRaw, start, end)
        });
    }
  }

  const weekData = [];
  const weekInterval = eachDayOfInterval({ start: startOfWeek(nowThai, { weekStartsOn: 1 }), end: endOfWeek(nowThai, { weekStartsOn: 1 }) });
  for (const d of weekInterval) {
    const start = startOfDay(d);
    const end = endOfDay(d);
    weekData.push({ 
        name: format(d, "EEE", { locale: th }), 
        falls: groupAndCount(falls, start, end), 
        heart: groupAndCount(heartRaw, start, end),
        temp: groupAndCount(tempRaw, start, end),
        zone: groupAndCount(zoneRaw, start, end)
    });
  }

  const monthData = [];
  const monthInterval = eachDayOfInterval({ start: startOfMonth(nowThai), end: endOfMonth(nowThai) });
  for (const d of monthInterval) {
    const start = startOfDay(d);
    const end = endOfDay(d);
    monthData.push({ 
        name: format(d, "d"), 
        falls: groupAndCount(falls, start, end), 
        heart: groupAndCount(heartRaw, start, end),
        temp: groupAndCount(tempRaw, start, end),
        zone: groupAndCount(zoneRaw, start, end)
    });
  }

  return { day: dayData, week: weekData, month: monthData };
}

async function getComparisonData() {
    const now = new Date();
    const startOfThisMonth = startOfMonth(now);
    const startOfThisWeek = startOfWeek(now, { weekStartsOn: 1 });
    const fetchStartDate = startOfThisMonth < startOfThisWeek ? startOfThisMonth : startOfThisWeek;

    const [
        fallTotal, 
        fallHelp, 
        heartTotal, 
        heartHelp,
        tempTotal, 
        tempHelp,
        zoneTotal, 
        zoneHelp
    ] = await Promise.all([
        prisma.fallRecord.findMany({ 
            where: { timestamp: { gte: fetchStartDate } }, 
            select: { timestamp: true } 
        }),
        prisma.extendedHelp.findMany({ 
            where: { 
                requestedAt: { gte: fetchStartDate }, 
                type: { in: ['FALL_CONSCIOUS', 'FALL_UNCONSCIOUS'] } 
            }, 
            select: { requestedAt: true } 
        }),
        prisma.heartRateRecord.findMany({ 
            where: { timestamp: { gte: fetchStartDate }, status: 'ABNORMAL'  }, 
            select: { timestamp: true } 
        }),
        prisma.extendedHelp.findMany({ 
            where: { requestedAt: { gte: fetchStartDate }, type: 'HEART_RATE' }, 
            select: { requestedAt: true } 
        }),
        
        prisma.temperatureRecord.findMany({ 
            where: { timestamp: { gte: fetchStartDate }, status: 'ABNORMAL'  }, 
            select: { timestamp: true } 
        }),
        prisma.extendedHelp.findMany({ 
            where: { requestedAt: { gte: fetchStartDate }, type: 'TEMPERATURE' }, 
            select: { requestedAt: true } 
        }),
        
        prisma.location.findMany({ 
            where: { timestamp: { gte: fetchStartDate }, status: 'DANGER' }, 
            select: { timestamp: true } 
        }),
        prisma.extendedHelp.findMany({ 
            where: { requestedAt: { gte: fetchStartDate }, type: 'ZONE' }, 
            select: { requestedAt: true } 
        }),
    ]);

    return [
        { 
            name: "การล้ม", 
            total: fallTotal.length, 
            critical: fallHelp.length, 
            fill: "#F97316" 
        },
        { 
            name: "หัวใจ", 
            total: heartTotal.length, 
            critical: countDistinctEvents(heartHelp), 
            fill: "#F500FF" 
        },
        { 
            name: "อุณหภูมิ", 
            total: tempTotal.length, 
            critical: countDistinctEvents(tempHelp), 
            fill: "#FFD600" 
        },
        { 
            name: "โซน", 
            total: zoneTotal.length, 
            critical: countDistinctEvents(zoneHelp), 
            fill: "#00E5FF" 
        },
    ];
}

async function getActiveAlerts() {
  const alerts = await prisma.extendedHelp.findMany({
    where: {
      status: { in: ['DETECTED', 'ACKNOWLEDGED'] }, 
    },
    orderBy: { requestedAt: 'desc' },
    include: {
      dependent: true 
    },
    take: 10 
  });

  const typeMapping: Record<string, string> = {
      FALL_CONSCIOUS: "ล้มมีการตอบสนอง",
      FALL_UNCONSCIOUS: "ล้มไม่มีการตอบสนอง",
      HEART_RATE: "ชีพจรผิดปกติ",
      TEMPERATURE: "อุณหภูมิผิดปกติ",
      ZONE: "ออกนอกเขตปลอดภัย",
  };

  return alerts.map(alert => {
    const rawType = alert.type || 'UNKNOWN';
    const humanType = typeMapping[rawType] || "แจ้งเตือน";

    return {
      id: alert.id,
      type: humanType,
      status: alert.status,
      timestamp: alert.requestedAt,
      dependentName: alert.dependent ? `${alert.dependent.firstName} ${alert.dependent.lastName}` : "ไม่ระบุชื่อ"
    };
  });
}

// --- Main Page Component ---
export default async function DashboardPage() {
  const session = await getSession();
  
  const adminProfile = await getAdminProfile(session);
  const adminName = adminProfile
    ? `${adminProfile.firstName} ${adminProfile.lastName}`
    : "Administrator";

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  
  const [
    totalDependents,
    totalAlertsCount,
    ackAlertsCount,   
    activeDevices,
    chartData,
    comparisonData,
    activeAlerts 
  ] = await Promise.all([
    prisma.dependentProfile.count(),
    
    // นับรวมทุก Type ที่เป็นเหตุฉุกเฉิน
    prisma.extendedHelp.count({ 
        where: { 
            requestedAt: { gte: startOfToday }
        } 
    }),

    // นับยอดที่รับเรื่องแล้ว
    prisma.extendedHelp.count({ 
        where: { 
            requestedAt: { gte: startOfToday },
            status: 'ACKNOWLEDGED' 
        } 
    }),

    prisma.location.groupBy({ by: ['dependentId'], where: { timestamp: { gte: new Date(Date.now() - 60 * 60 * 1000) } } }).then(res => res.length),
    getChartData(),
    getComparisonData(),
    getActiveAlerts()
  ]);

  return (
    <div className="h-[calc(100vh-138px)] w-full bg-slate-50 p-3 overflow-hidden">
        <AutoRefresh />
      <div className="grid grid-cols-12 gap-3 h-full">
        
        {/* ส่วนซ้าย - กราฟหลัก */}
        <div className="col-span-12 lg:col-span-9 h-full">
            <ChartSection 
                overviewData={chartData} 
                comparisonData={comparisonData} 
                adminName={adminName} 
            />
        </div>

        {/* ส่วนขวา - Stats & Funnel */}
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
                    title="แจ้งเตือนฉุกเฉิน" 
                    value={totalAlertsCount} 
                    icon={ShieldAlert}
                    color="orange"
                    trend={totalAlertsCount > 0 ? "down" : "neutral"}
                />
            </div>
            
            <div className="flex-1 min-h-0">
                 <AlertFunnel activeAlerts={activeAlerts} />
            </div>  
            
        </div>
      </div>
    </div>
  );
}