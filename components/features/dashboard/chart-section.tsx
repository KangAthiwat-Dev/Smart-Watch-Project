"use client";

import { useState } from "react";
import OverviewChart from "./overview-chart";
import AlertComparison from "./alert-comparison";
import { BarChart2, LineChart } from "lucide-react";


interface ChartSectionProps {
  overviewData: any;
  comparisonData: any;
  adminName: string;
  customData?: any;
  customRange?: { start: Date; end: Date };
}

export default function ChartSection({ overviewData, comparisonData, adminName, customData, customRange }: ChartSectionProps) {
  const [mode, setMode] = useState<"overview" | "comparison">("overview");

  return (
    <div className="w-full h-full flex flex-col gap-4">

      { }
      <div className="flex items-center justify-between shrink-0">

        { }
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-gray-100 leading-tight">Dashboard Overview</h2>
          <p className="text-xs text-slate-500 dark:text-gray-400">
            ยินดีต้อนรับคุณ <span className="text-blue-600 dark:text-blue-400 font-semibold">{adminName}</span>
          </p>
        </div>

        { }
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode("overview")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold transition-all border ${mode === "overview"
              ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200 dark:shadow-blue-900/50"
              : "bg-white dark:bg-gray-800 text-slate-500 dark:text-gray-400 border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700"
              }`}
          >
            <LineChart className="w-3 h-3" />
            ภาพรวม
          </button>
          <button
            onClick={() => setMode("comparison")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold transition-all border ${mode === "comparison"
              ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200 dark:shadow-blue-900/50"
              : "bg-white dark:bg-gray-800 text-slate-500 dark:text-gray-400 border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700"
              }`}
          >
            <BarChart2 className="w-3 h-3" />
            เปรียบเทียบ
          </button>
        </div>

      </div>

      { }
      <div className="flex-1 min-h-0 bg-white dark:bg-gray-800 rounded-3xl border border-slate-100 dark:border-gray-700 shadow-sm overflow-hidden transition-colors duration-300">
        {mode === "overview" ? (
          <OverviewChart data={overviewData} customData={customData} customRange={customRange} />
        ) : (
          <AlertComparison data={comparisonData} />
        )}
      </div>
    </div>
  );
}