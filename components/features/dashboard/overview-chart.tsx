"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  Pie,
  PieChart,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Area,
  AreaChart,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Activity, CalendarDays, Zap } from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";

// 1. ชุดสี Premium Tech (หรูหรา ทันสมัย สบายตา)
const COLORS = {
    falls: "#F59E0B", // Amber Gold (หรูหรา)
    sos: "#F43F5E",   // Rose Red (ฉุกเฉินแบบผู้ดี)
    heart: "#8B5CF6", // Royal Violet (ล้ำสมัย)
    temp: "#06B6D4",  // Cyan Teal (สะอาด)
    zone: "#3B82F6",  // Royal Blue (มั่นคง)
};

interface ChartData {
  name: string;
  falls: number;
  sos: number;
  heart: number;
  temp: number;
  zone: number;
}

interface OverviewChartProps {
  data?: {
    day: ChartData[];
    week: ChartData[];
    month: ChartData[];
  };
}

// Custom Tooltip (Theme: White Glassmorphism)
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-slate-100/50 text-xs">
        <p className="font-bold mb-3 text-slate-700 text-sm border-b border-slate-100 pb-2 flex items-center gap-2">
           <CalendarDays className="w-4 h-4 text-slate-400" /> {label}
        </p>
        <div className="space-y-2">
            {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-6 min-w-[140px]">
                <div className="flex items-center gap-2.5">
                    <div
                    className="w-2.5 h-2.5 rounded-full shadow-sm"
                    style={{ backgroundColor: entry.color }}
                    />
                    <span className="capitalize text-slate-500 font-semibold tracking-wide">
                        {entry.name}
                    </span>
                </div>
                <span className="font-bold text-slate-800 text-lg tabular-nums">
                    {entry.value}
                </span>
            </div>
            ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function OverviewChart({ data }: OverviewChartProps) {
  const [chartType, setChartType] = useState("area");
  const [range, setRange] = useState<"day" | "week" | "month">("week");

  const safeData = data || { day: [], week: [], month: [] };
  const currentData = safeData[range] || [];

  const totalFalls = currentData.reduce((acc, curr) => acc + (curr.falls || 0), 0);
  const totalSOS = currentData.reduce((acc, curr) => acc + (curr.sos || 0), 0);
  const totalHeart = currentData.reduce((acc, curr) => acc + (curr.heart || 0), 0);
  const totalTemp = currentData.reduce((acc, curr) => acc + (curr.temp || 0), 0);
  const totalZone = currentData.reduce((acc, curr) => acc + (curr.zone || 0), 0);
  const grandTotal = totalFalls + totalSOS + totalHeart + totalTemp + totalZone;

  const pieData = [
    { name: "การล้ม", value: totalFalls, color: COLORS.falls },
    { name: "SOS", value: totalSOS, color: COLORS.sos },
    { name: "หัวใจ", value: totalHeart, color: COLORS.heart },
    { name: "อุณหภูมิ", value: totalTemp, color: COLORS.temp },
    { name: "โซน", value: totalZone, color: COLORS.zone },
  ].filter((item) => item.value > 0);

  const currentMonth = format(new Date(), "MMMM yyyy", { locale: th });

  return (
    // Container: Clean White Luxury
    <div className="w-full h-full p-6 bg-white rounded-[32px] border border-slate-100 shadow-[0_2px_40px_-10px_rgba(0,0,0,0.06)] flex flex-col relative overflow-hidden group">
      
      {/* Subtle Gradient Blob Background (เพิ่มมิติแบบแพงๆ) */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-blue-50/50 to-purple-50/50 rounded-full blur-3xl opacity-60 pointer-events-none -translate-y-1/2 translate-x-1/3" />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 shrink-0 z-20 relative">
        <div>
          <h3 className="text-slate-800 font-bold text-xl flex items-center gap-3 tracking-tight">
            <div className="p-2.5 bg-gradient-to-br from-slate-900 to-slate-700 text-white rounded-2xl shadow-lg shadow-slate-200">
              <Activity className="w-5 h-5" strokeWidth={2.5} />
            </div>
            <span>สถิติความปลอดภัย</span>
          </h3>
          <div className="flex items-center gap-2 mt-2 ml-14">
            <p className="text-slate-400 text-sm font-medium bg-slate-50 px-3 py-1 rounded-full">
              {currentMonth}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100/80 p-1.5 rounded-full">
            {(["day", "week", "month"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-5 py-2 text-xs font-bold rounded-full transition-all duration-300 ${
                  range === r
                    ? "bg-white text-slate-900 shadow-md scale-105"
                    : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
                }`}
              >
                {r === "day" ? "วัน" : r === "week" ? "สัปดาห์" : "เดือน"}
              </button>
            ))}
          </div>

          <Select value={chartType} onValueChange={setChartType}>
            <SelectTrigger className="w-[140px] h-11 rounded-full border-0 bg-slate-50 text-sm font-semibold text-slate-600 focus:ring-2 focus:ring-slate-200">
              <SelectValue placeholder="รูปแบบกราฟ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="area">พื้นที่ (Area)</SelectItem>
              <SelectItem value="bar">แท่ง (Bar)</SelectItem>
              <SelectItem value="pie">วงกลม (Pie)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Chart Area */}
      <div className="flex-1 w-full min-h-0 relative z-10">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "pie" ? (
            <PieChart>
                <defs>
                   <filter id="pieShadow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#000000" floodOpacity="0.1" />
                   </filter>
                </defs>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={90}
                outerRadius={135}
                paddingAngle={4}
                dataKey="value"
                stroke="none"
                filter="url(#pieShadow)"
              >
                {pieData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color} 
                    className="hover:opacity-90 transition-all duration-300 cursor-pointer hover:scale-105 origin-center"
                    stroke="none"
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" className="fill-slate-400 text-xs font-bold uppercase tracking-widest">เหตุการณ์รวม</text>
              <text x="50%" y="56%" textAnchor="middle" dominantBaseline="middle" className="fill-slate-800 text-4xl font-black">{grandTotal}</text>
            </PieChart>
          ) : (
             chartType === "bar" ? (
                <BarChart data={currentData} barGap={8}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} fontWeight={600} tickLine={false} axisLine={false} dy={15} />
                    <YAxis stroke="#94a3b8" fontSize={11} fontWeight={600} tickLine={false} axisLine={false} allowDecimals={false} domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.2)]} />
                    
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
                    
                    {/* Modern Rounded Bars */}
                    <Bar name="การล้ม" dataKey="falls" fill={COLORS.falls} radius={[6, 6, 6, 6]} barSize={10} />
                    <Bar name="SOS" dataKey="sos" fill={COLORS.sos} radius={[6, 6, 6, 6]} barSize={10} />
                    <Bar name="หัวใจ" dataKey="heart" fill={COLORS.heart} radius={[6, 6, 6, 6]} barSize={10} />
                    <Bar name="อุณหภูมิ" dataKey="temp" fill={COLORS.temp} radius={[6, 6, 6, 6]} barSize={10} />
                    <Bar name="โซน" dataKey="zone" fill={COLORS.zone} radius={[6, 6, 6, 6]} barSize={10} />
                </BarChart>
             ) : (
                <AreaChart data={currentData}>
                    <defs>
                        {/* Premium Soft Gradients */}
                        <linearGradient id="colorFalls" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.falls} stopOpacity={0.3}/><stop offset="95%" stopColor={COLORS.falls} stopOpacity={0}/></linearGradient>
                        <linearGradient id="colorSOS" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.sos} stopOpacity={0.3}/><stop offset="95%" stopColor={COLORS.sos} stopOpacity={0}/></linearGradient>
                        <linearGradient id="colorHeart" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.heart} stopOpacity={0.3}/><stop offset="95%" stopColor={COLORS.heart} stopOpacity={0}/></linearGradient>
                        <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.temp} stopOpacity={0.3}/><stop offset="95%" stopColor={COLORS.temp} stopOpacity={0}/></linearGradient>
                        <linearGradient id="colorZone" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.zone} stopOpacity={0.3}/><stop offset="95%" stopColor={COLORS.zone} stopOpacity={0}/></linearGradient>
                        
                        {/* Soft Drop Shadow Filter for Lines */}
                        <filter id="lineShadow" x="-50%" y="-50%" width="200%" height="200%">
                            <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#000000" floodOpacity="0.15" />
                        </filter>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} fontWeight={600} tickLine={false} axisLine={false} dy={15} />
                    <YAxis stroke="#94a3b8" fontSize={11} fontWeight={600} tickLine={false} axisLine={false} allowDecimals={false} domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.2)]} />

                    <Tooltip content={<CustomTooltip />} />
                    
                    {/* Clean Lines with Soft Shadows */}
                    <Area type="monotone" dataKey="falls" name="การล้ม" stroke={COLORS.falls} strokeWidth={3} fillOpacity={1} fill="url(#colorFalls)" filter="url(#lineShadow)" />
                    <Area type="monotone" dataKey="sos" name="SOS" stroke={COLORS.sos} strokeWidth={3} fillOpacity={1} fill="url(#colorSOS)" filter="url(#lineShadow)" />
                    <Area type="monotone" dataKey="heart" name="หัวใจ" stroke={COLORS.heart} strokeWidth={3} fillOpacity={1} fill="url(#colorHeart)" filter="url(#lineShadow)" />
                    <Area type="monotone" dataKey="temp" name="อุณหภูมิ" stroke={COLORS.temp} strokeWidth={3} fillOpacity={1} fill="url(#colorTemp)" filter="url(#lineShadow)" />
                    <Area type="monotone" dataKey="zone" name="โซน" stroke={COLORS.zone} strokeWidth={3} fillOpacity={1} fill="url(#colorZone)" filter="url(#lineShadow)" />
                </AreaChart>
             )
          )}
        </ResponsiveContainer>
      </div>

      {/* Legend (Minimalist Badges) */}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-6 pt-6 border-t border-slate-50 shrink-0 z-20">
        {[
            { label: "การล้ม", color: COLORS.falls },
            { label: "SOS", color: COLORS.sos },
            { label: "หัวใจ", color: COLORS.heart },
            { label: "อุณหภูมิ", color: COLORS.temp },
            { label: "โซน", color: COLORS.zone },
        ].map((item, idx) => (
            <div key={idx} className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-slate-50 border border-slate-100 transition-all hover:scale-105 hover:bg-white hover:shadow-sm cursor-default">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-xs font-bold text-slate-600">{item.label}</span>
            </div>
        ))}
      </div>
    </div>
  );
}