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
  Line,
  LineChart,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Activity, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";

// ชุดสีธีมน้ำเงิน
const COLORS = {
  falls: "#3B82F6",   // Blue 500
  sos: "#DC2626",     // Red 600
  heart: "#8B5CF6",   // Violet 500
  temp: "#10B981",    // Emerald 500
  zone: "#F59E0B",    // Amber 500
};

interface ChartData {
  name: string;
  falls: number;
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

// Custom Tooltip with Percentage
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const total = payload.reduce((sum: number, entry: any) => sum + entry.value, 0);
    
    return (
      <div className="bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-blue-100/50 text-xs">
        <p className="font-bold mb-3 text-slate-700 text-sm border-b border-blue-100 pb-2 flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-blue-400" /> {label}
        </p>
        <div className="space-y-2">
          {payload.map((entry: any, index: number) => {
            const percentage = total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0.0";
            return (
              <div key={index} className="flex items-center justify-between gap-6 min-w-[180px]">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full shadow-sm"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="capitalize text-slate-500 font-semibold tracking-wide">
                    {entry.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800 text-base tabular-nums">
                    {entry.value}
                  </span>
                  <span className="text-blue-600 font-bold text-xs">
                    ({percentage}%)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

export default function OverviewChart({ data }: OverviewChartProps) {
  const [chartType, setChartType] = useState("bar");
  const [range, setRange] = useState<"day" | "week" | "month">("week");

  // ==========================================
  // 🔥🔥🔥 แก้แบบลูกทุ่ง: บวกเวลาเพิ่ม 7 ชั่วโมง (25200000 ms) ไปเลย
  // ==========================================
  const now = new Date();
  // ถ้าบน Vercel (UTC) เวลา 00:00 -> บวก 7 ชม -> เป็น 07:00 (เวลาไทย)
  const thaiTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
  
  const currentMonth = format(thaiTime, "MMMM yyyy", { locale: th });
  // ==========================================

  const safeData = data || { day: [], week: [], month: [] };
  const currentData = safeData[range] || [];

  const totalFalls = currentData.reduce((acc, curr) => acc + (curr.falls || 0), 0);
  const totalHeart = currentData.reduce((acc, curr) => acc + (curr.heart || 0), 0);
  const totalTemp = currentData.reduce((acc, curr) => acc + (curr.temp || 0), 0);
  const totalZone = currentData.reduce((acc, curr) => acc + (curr.zone || 0), 0);
  const grandTotal = totalFalls + totalHeart + totalTemp + totalZone;

  const pieData = [
    { name: "การล้ม", value: totalFalls, color: COLORS.falls },
    { name: "หัวใจ", value: totalHeart, color: COLORS.heart },
    { name: "อุณหภูมิ", value: totalTemp, color: COLORS.temp },
    { name: "โซน", value: totalZone, color: COLORS.zone },
  ].filter((item) => item.value > 0);

  return (
    <div className="w-full h-full p-6 bg-white rounded-[32px] border border-blue-100 shadow-[0_2px_40px_-10px_rgba(59,130,246,0.1)] flex flex-col relative overflow-hidden group">
      
      {/* Blue Gradient Background */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-blue-50/60 to-indigo-50/60 rounded-full blur-3xl opacity-70 pointer-events-none -translate-y-1/2 translate-x-1/3" />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 shrink-0 z-20 relative">
        <div>
          <h3 className="text-slate-800 font-bold text-xl flex items-center gap-3 tracking-tight">
            <div className="p-2.5 bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-2xl shadow-lg shadow-blue-200">
              <Activity className="w-5 h-5" strokeWidth={2.5} />
            </div>
            <span>สถิติความปลอดภัย</span>
          </h3>
          <div className="flex items-center gap-2 mt-2 ml-14">
            <p className="text-slate-400 text-sm font-medium bg-blue-50 px-3 py-1 rounded-full">
              {/* ✅ แสดงตัวแปรตรงๆ เลย ไม่ต้องรอ useEffect */}
              {currentMonth}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-blue-50/80 p-1.5 rounded-full">
            {(["day", "week", "month"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-5 py-2 text-xs font-bold rounded-full transition-all duration-300 ${
                  range === r
                    ? "bg-blue-600 text-white shadow-md shadow-blue-200 scale-105"
                    : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
                }`}
              >
                {r === "day" ? "วัน" : r === "week" ? "สัปดาห์" : "เดือน"}
              </button>
            ))}
          </div>

          <Select value={chartType} onValueChange={setChartType}>
            <SelectTrigger className="w-[140px] h-11 rounded-full border-0 bg-blue-50 text-sm font-semibold text-blue-700 focus:ring-2 focus:ring-blue-200">
              <SelectValue placeholder="รูปแบบกราฟ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bar">แท่ง</SelectItem>
              <SelectItem value="line">เส้น</SelectItem>
              <SelectItem value="pie">วงกลม</SelectItem>
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
                  <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#3B82F6" floodOpacity="0.15" />
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
              <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" className="fill-blue-400 text-xs font-bold uppercase tracking-widest">เหตุการณ์รวม</text>
              <text x="50%" y="56%" textAnchor="middle" dominantBaseline="middle" className="fill-blue-700 text-4xl font-black">{grandTotal}</text>
            </PieChart>
          ) : chartType === "line" ? (
            <LineChart data={currentData}>
              <defs>
                <filter id="lineShadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#3B82F6" floodOpacity="0.2" />
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#DBEAFE" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} fontWeight={600} tickLine={false} axisLine={false} dy={15} />
              <YAxis stroke="#94a3b8" fontSize={11} fontWeight={600} tickLine={false} axisLine={false} allowDecimals={false} domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.2)]} />

              <Tooltip content={<CustomTooltip />} />
              
              <Line type="monotone" dataKey="falls" name="การล้ม" stroke={COLORS.falls} strokeWidth={3} dot={{ fill: COLORS.falls, r: 4 }} activeDot={{ r: 6 }} filter="url(#lineShadow)" />
              <Line type="monotone" dataKey="heart" name="หัวใจ" stroke={COLORS.heart} strokeWidth={3} dot={{ fill: COLORS.heart, r: 4 }} activeDot={{ r: 6 }} filter="url(#lineShadow)" />
              <Line type="monotone" dataKey="temp" name="อุณหภูมิ" stroke={COLORS.temp} strokeWidth={3} dot={{ fill: COLORS.temp, r: 4 }} activeDot={{ r: 6 }} filter="url(#lineShadow)" />
              <Line type="monotone" dataKey="zone" name="โซน" stroke={COLORS.zone} strokeWidth={3} dot={{ fill: COLORS.zone, r: 4 }} activeDot={{ r: 6 }} filter="url(#lineShadow)" />
            </LineChart>
          ) : (
            <BarChart data={currentData} barGap={8}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#DBEAFE" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} fontWeight={600} tickLine={false} axisLine={false} dy={15} />
              <YAxis stroke="#94a3b8" fontSize={11} fontWeight={600} tickLine={false} axisLine={false} allowDecimals={false} domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.2)]} />
              
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "#EFF6FF" }} />
              
              <Bar name="การล้ม" dataKey="falls" fill={COLORS.falls} radius={[6, 6, 6, 6]} barSize={10} />
              <Bar name="หัวใจ" dataKey="heart" fill={COLORS.heart} radius={[6, 6, 6, 6]} barSize={10} />
              <Bar name="อุณหภูมิ" dataKey="temp" fill={COLORS.temp} radius={[6, 6, 6, 6]} barSize={10} />
              <Bar name="โซน" dataKey="zone" fill={COLORS.zone} radius={[6, 6, 6, 6]} barSize={10} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-6 pt-6 border-t border-blue-50 shrink-0 z-20">
        {[
          { label: "การล้ม", color: COLORS.falls },
          { label: "หัวใจ", color: COLORS.heart },
          { label: "อุณหภูมิ", color: COLORS.temp },
          { label: "โซน", color: COLORS.zone },
        ].map((item, idx) => (
          <div key={idx} className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-blue-50/50 border border-blue-100 transition-all hover:scale-105 hover:bg-blue-50 hover:shadow-sm cursor-default">
            <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: item.color }} />
            <span className="text-xs font-bold text-blue-700">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}