import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  change?: string;
  trend?: "up" | "down" | "neutral";
  subtext?: string;
  color?: "blue" | "orange" | "purple" | "pink" | "emerald";
}

export default function StatsCard({
  title,
  value,
  icon: Icon,
  change,
  trend,
  subtext,
  color = "blue",
}: StatsCardProps) {

  const colorStyles = {
    blue: { bg: "bg-blue-50", text: "text-blue-600" },
    orange: { bg: "bg-orange-50", text: "text-orange-600" },
    purple: { bg: "bg-purple-50", text: "text-purple-600" },
    pink: { bg: "bg-pink-50", text: "text-pink-600" },
    emerald: { bg: "bg-emerald-50", text: "text-emerald-600" },
  };

  const currentStyle = colorStyles[color] || colorStyles.blue;

  return (
    <Card className="h-full rounded-2xl shadow-sm border border-slate-100 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center overflow-hidden transition-colors duration-300">
      <CardContent className="p-4 w-full flex items-center gap-3">

        { }
        {Icon && (
          <div
            className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center transition-colors ${currentStyle.bg}`}
          >
            <Icon className={`w-5 h-5 ${currentStyle.text}`} />
          </div>
        )}

        { }
        <div className="flex flex-col min-w-0">
          { }
          <p className="text-2xl font-bold text-slate-800 dark:text-gray-100 tracking-tight leading-tight">
            {value}
          </p>

          <p className="text-xs font-medium text-slate-500 dark:text-gray-400 truncate mt-0.5">
            {title}
          </p>

          <div className="flex items-center gap-2 mt-0.5">
            {change && (
              <span
                className={`text-[10px] font-bold flex items-center ${trend === "up"
                  ? "text-emerald-600"
                  : trend === "down"
                    ? "text-rose-600"
                    : "text-slate-400"
                  }`}
              >
                {trend === "up" ? "↑" : trend === "down" ? "↓" : ""} {change}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}