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

// ✅ Custom Tooltip: ปรับให้สีจุด (Dot) ตรงกับสีของแท่งกราฟเป๊ะๆ
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    // ดึงสี Theme จากข้อมูลแท่งนั้นๆ (เช่น การล้ม = สีส้ม)
    const criticalEntry = payload.find((p: any) => p.dataKey === "critical");
    const themeColor = criticalEntry?.payload?.fill || "#000";

    return (
      <div className="bg-white p-4 rounded-2xl shadow-xl border border-slate-100 text-xs min-w-[200px]">
        <p className="font-extrabold mb-3 text-slate-800 text-sm border-b border-slate-100 pb-2 flex items-center gap-2">
          <span className="p-1 rounded-md bg-slate-50">
            <Zap className="w-3 h-3" style={{ color: themeColor }} />
          </span>
          {label}
        </p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4 mb-2 last:mb-0">
            <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ 
                    // ถ้าเป็น Total ให้ใช้สีเดียวกันแต่จางลง (Opacity)
                    backgroundColor: themeColor,
                    opacity: entry.dataKey === "total" ? 0.3 : 1
                  }} 
                />
                <span className={`font-bold ${entry.dataKey === "total" ? "text-slate-400" : "text-slate-700"}`}>
                    {entry.name === "total" ? "ตรวจพบทั้งหมด" : "วิกฤต/แจ้งเตือน"}
                </span>
            </div>
            <span className="font-black text-slate-800 text-base">
                {entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function AlertComparison({ data }: any) {
  // ข้อมูลตาม Code สีที่นายน้อยระบุมาเป๊ะๆ
  const safeData = data || [
      { name: "การล้ม", total: 0, critical: 0, fill: "#F97316" },
      { name: "หัวใจ", total: 0, critical: 0, fill: "#F500FF" },
      { name: "อุณหภูมิ", total: 0, critical: 0, fill: "#FFD600" },
      { name: "โซน", total: 0, critical: 0, fill: "#00E5FF" },
  ];

  return (
    // ✅ Container: Clean White Minimal
    <div className="w-full h-full p-6 bg-white rounded-[32px] border border-slate-100 shadow-sm flex flex-col relative overflow-hidden">
      
      {/* Header Section */}
      <div className="flex items-center justify-between mb-8 shrink-0 z-20 relative">
        <div className="flex items-center gap-4">
            <div className="w-12 h-12 flex items-center justify-center bg-slate-50 border border-slate-100 rounded-2xl text-slate-700">
                <Scale className="w-6 h-6" />
            </div>
            <div>
                <h3 className="font-black text-slate-800 text-xl tracking-tight">
                    อัตราส่วนความเสี่ยง
                </h3>
                <p className="text-sm text-slate-400 font-medium">ตรวจพบทั้งหมด vs วิกฤต</p>
            </div>
        </div>
        <div className="p-2 bg-slate-50 rounded-full text-slate-400 border border-slate-100">
            <ArrowRightLeft className="w-5 h-5" />
        </div>
      </div>

      {/* Chart Area */}
      <div className="flex-1 w-full min-h-0 relative z-10 pl-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={safeData} barGap={4}>
            
            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
            
            <XAxis 
                dataKey="name" 
                stroke="#94a3b8" 
                fontSize={12} 
                fontWeight={600}
                tickLine={false} 
                axisLine={false} 
                dy={10}
            />
            <YAxis 
                stroke="#94a3b8" 
                fontSize={12} 
                fontWeight={600}
                tickLine={false} 
                axisLine={false}
                tickFormatter={(value) => value > 0 ? value : ""}
            />
            <Tooltip 
                content={<CustomTooltip />}
                cursor={{ fill: "#f8fafc" }} 
            />
            
            {/* Bar 1: เหตุการณ์ทั้งหมด (Total) 
               ✅ แก้ไข: ใช้สีเดียวกับหมวดหมู่นั้นๆ แต่ปรับ Opacity ให้จางเหลือ 15%
            */}
            <Bar 
                name="total" 
                dataKey="total" 
                radius={[6, 6, 6, 6]} 
                barSize={24}
            >
                {safeData.map((entry: any, index: number) => (
                    <Cell 
                        key={`cell-total-${index}`} 
                        fill={entry.fill} 
                        fillOpacity={0.25} // จางลงเพื่อให้รู้ว่าเป็น Background/Total
                    />
                ))}
            </Bar>
            
            {/* Bar 2: วิกฤต (Critical)
               ✅ แก้ไข: ใช้สีเดียวกับหมวดหมู่นั้นๆ แบบเข้ม (Solid)
            */}
            <Bar 
                name="critical" 
                dataKey="critical" 
                radius={[6, 6, 6, 6]} 
                barSize={24}
            >
                {safeData.map((entry: any, index: number) => (
                    <Cell 
                        key={`cell-crit-${index}`} 
                        fill={entry.fill} 
                        fillOpacity={1} // เข้มเต็มร้อย
                        className="transition-opacity duration-300 hover:opacity-80"
                    />
                ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend: อธิบายความหมายของสีเข้ม/สีจาง */}
      <div className="flex items-center justify-center gap-8 mt-6 pt-4 border-t border-slate-50 shrink-0 z-20">
        <div className="flex items-center gap-2.5">
          {/* วงกลมสีเทาจางๆ แทนความหมายของ Total */}
          <div className="w-3 h-3 bg-slate-800/15 rounded-full" />
          <span className="text-xs font-bold text-slate-500">ทั้งหมด</span>
        </div>
        <div className="flex items-center gap-2.5">
          {/* วงกลมสีเข้ม แทนความหมายของ Critical */}
          <div className="w-3 h-3 bg-slate-800 rounded-full" />
          <span className="text-xs font-bold text-slate-700">แจ้งเตือน</span>
        </div>
      </div>

    </div>
  );
}