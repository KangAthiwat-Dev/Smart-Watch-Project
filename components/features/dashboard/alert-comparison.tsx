"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import { Scale, ArrowRightLeft, Zap } from "lucide-react";

// ✅ Custom Tooltip แบบ Neon Dark Theme
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    // หา entry ของ critical เพื่อดึงสีมาใช้
    const criticalEntry = payload.find((p: any) => p.dataKey === "critical");
    const themeColor = criticalEntry?.payload?.fill || "#fff";

    return (
      <div className="bg-[#0a0a0a]/95 backdrop-blur-xl text-white p-4 rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.5)] text-xs border border-white/10" style={{ boxShadow: `0 0 20px ${themeColor}40` }}>
        <p className="font-black mb-3 text-slate-200 text-sm border-b border-white/10 pb-2 flex items-center gap-2">
          <Zap className="w-3 h-3 animate-pulse" style={{ color: themeColor }} /> {label}
        </p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4 mb-2 last:mb-0">
            <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full shadow-sm"
                  style={{ 
                    backgroundColor: entry.dataKey === "total" ? "#64748b" : themeColor,
                    boxShadow: entry.dataKey === "critical" ? `0 0 10px ${themeColor}` : "none"
                  }} 
                />
                <span className={`capitalize font-bold ${entry.dataKey === "total" ? "text-slate-400" : "text-white glow-text"}`}>
                    {entry.name === "total" ? "ตรวจพบทั้งหมด" : "วิกฤต/แจ้งเตือน"}
                </span>
            </div>
            <span className="font-black text-white text-base">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function AlertComparison({ data }: any) {
  // ข้อมูลกันตาย (เผื่อไม่มี data ส่งมา)
  const safeData = data || [
      { name: "การล้ม", total: 0, critical: 0, fill: "#FF6D00" },
      { name: "หัวใจ", total: 0, critical: 0, fill: "#F500FF" },
      { name: "อุณหภูมิ", total: 0, critical: 0, fill: "#FFD600" },
      { name: "โซน", total: 0, critical: 0, fill: "#00E5FF" },
  ];

  return (
    // Container Neon Glassmorphism
    <div className="w-full h-full p-6 bg-slate-900/5 backdrop-blur-2xl rounded-3xl border border-white/20 shadow-[inset_0_0_20px_rgba(255,255,255,0.1)] flex flex-col relative overflow-hidden group">
      
      {/* CSS Glow Text */}
      <style jsx global>{`
        .glow-text { text-shadow: 0 0 10px rgba(255,255,255,0.5); }
      `}</style>

      {/* Background Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:20px_20px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,black,transparent)] z-0 pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-6 shrink-0 z-20 relative">
        <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl shadow-[0_0_15px_rgba(255,255,255,0.2)] text-white">
                <Scale className="w-5 h-5" />
            </div>
            <div>
                <h3 className="font-black text-slate-800 text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600">
                    อัตราส่วนความเสี่ยง
                </h3>
                <p className="text-xs text-slate-500 font-bold">ตรวจพบทั้งหมด vs วิกฤต</p>
            </div>
        </div>
        <div className="p-2 bg-white/20 backdrop-blur rounded-full text-slate-500 border border-white/30">
            <ArrowRightLeft className="w-4 h-4" />
        </div>
      </div>

      {/* Chart Area */}
      <div className="flex-1 w-full min-h-0 relative z-10">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={safeData} barGap={4}>
            
            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#ffffff" strokeOpacity={0.1} />
            <XAxis 
                dataKey="name" 
                stroke="#64748b" 
                fontSize={12} 
                fontWeight={700}
                tickLine={false} 
                axisLine={false} 
                dy={10}
            />
            <YAxis 
                stroke="#64748b" 
                fontSize={12} 
                fontWeight={700}
                tickLine={false} 
                axisLine={false}
                tickFormatter={(value) => value > 0 ? value : ""}
            />
            <Tooltip 
                content={<CustomTooltip />}
                cursor={{ fill: "#ffffff", opacity: 0.05 }}
            />
            
            {/* Bar 1: เหตุการณ์ทั้งหมด (สีเทาจางๆ เป็น Background) */}
            <Bar 
                name="total" 
                dataKey="total" 
                fill="#94a3b8" 
                radius={[4, 4, 4, 4]} 
                barSize={20}
                fillOpacity={0.2}
            />
            
            {/* Bar 2: วิกฤต (สี Neon ตามประเภท) */}
            <Bar 
                name="critical" 
                dataKey="critical" 
                radius={[4, 4, 4, 4]} 
                barSize={20}
                // จัดการเรื่อง Z-Index ให้ทับแท่งแรกแบบเท่ๆ (ใน Recharts ใช้ margin ติดลบไม่ได้ แต่เราวางคู่กันได้)
            >
                {safeData.map((entry: any, index: number) => (
                    <Cell 
                        key={`cell-${index}`} 
                        fill={entry.fill} 
                        style={{ filter: `drop-shadow(0 0 6px ${entry.fill})` }} // Neon Glow
                        className="transition-all duration-300 hover:opacity-80"
                    />
                ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Custom Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-white/20 shrink-0 z-20">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100/50 border border-slate-200 transition-transform hover:scale-105">
          <div className="w-2.5 h-2.5 bg-slate-400 rounded-full opacity-50" />
          <span className="text-[10px] font-bold text-slate-500">ทั้งหมด</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 border border-white/40 shadow-sm transition-transform hover:scale-105">
          <div className="w-2.5 h-2.5 bg-gradient-to-r from-pink-500 to-cyan-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
          <span className="text-[10px] font-bold text-slate-700">วิกฤต (แจ้งเตือน)</span>
        </div>
      </div>

    </div>
  );
}