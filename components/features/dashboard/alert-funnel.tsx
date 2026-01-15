"use client";

import { format } from "date-fns";
import { th } from "date-fns/locale";
import { AlertTriangle, CheckCircle, Clock, Bell, HeartPulse, MapPin, Thermometer } from "lucide-react";

interface AlertItem {
  id: number;
  type: string;
  status: string;
  timestamp: Date;
  dependentName: string;
}

interface ActiveAlertsProps {
  activeAlerts: AlertItem[];
}

export default function AlertFunnel({ activeAlerts }: ActiveAlertsProps) {


  const formatThaiTime = (dateInput: Date) => {
    return new Intl.DateTimeFormat('th-TH', {
      timeZone: 'Asia/Bangkok',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date(dateInput));
  };


  if (!activeAlerts || activeAlerts.length === 0) {
    return (
      <div className="w-full h-[calc(100vh-28.8rem)] bg-white rounded-[24px] border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.04)] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
          <CheckCircle className="w-8 h-8 text-slate-300" strokeWidth={1.5} />
        </div>
        <h3 className="text-slate-600 font-medium mb-1">สถานการณ์ปกติ</h3>
        <p className="text-xs text-slate-400 font-light">
          ไม่พบการแจ้งเตือนใหม่
        </p>
      </div>
    );
  }


  return (
    <div className="w-full h-[calc(100vh-28.8rem)] bg-white dark:bg-gray-800 rounded-[24px] border border-slate-100 dark:border-gray-700 shadow-[0_8px_30px_rgba(0,0,0,0.04)] flex flex-col overflow-hidden transition-colors duration-300">

      { }
      <div className="px-5 py-4 bg-white dark:bg-gray-800 border-b border-slate-50 dark:border-gray-700 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bell className="w-5 h-5 text-slate-700 dark:text-gray-300" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-gray-800"></span>
          </div>
          <h3 className="font-semibold text-slate-700 dark:text-gray-200 text-sm">การแจ้งเตือน</h3>
        </div>
        <span className="text-[10px] text-slate-400 dark:text-gray-500 font-medium bg-slate-50 dark:bg-gray-900 px-2 py-1 rounded-full">
          {activeAlerts.length} รายการ
        </span>
      </div>

      { }
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 bg-white dark:bg-gray-800 scrollbar-hide">
        {activeAlerts.map((alert, index) => {
          const isAck = alert.status === "ACKNOWLEDGED";


          let icon = <AlertTriangle className="w-5 h-5" />;
          let themeColor = isAck ? "text-orange-500" : "text-red-500";
          let bgIcon = isAck ? "bg-orange-50 dark:bg-orange-900/20" : "bg-red-50 dark:bg-red-900/20";

          if (alert.type.includes("หัวใจ")) icon = <HeartPulse className="w-5 h-5" />;
          else if (alert.type.includes("พื้นที่")) icon = <MapPin className="w-5 h-5" />;
          else if (alert.type.includes("อุณหภูมิ")) icon = <Thermometer className="w-5 h-5" />;


          const thaiTime = new Date(new Date(alert.timestamp).getTime() + (7 * 60 * 60 * 1000));

          return (
            <div
              key={`${alert.type}-${alert.id}-${index}`}
              className="group w-full p-4 bg-white dark:bg-gray-800 rounded-2xl border border-slate-100 dark:border-gray-700 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.08)] hover:border-slate-200 dark:hover:border-gray-600 transition-all duration-300 flex items-center gap-4 cursor-default"
            >
              { }
              <div className={`w-10 h-10 rounded-full ${bgIcon} ${themeColor} flex items-center justify-center shrink-0 transition-transform group-hover:scale-110`}>
                {icon}
              </div>

              { }
              <div className="flex-1 min-w-0 flex flex-col justify-center pr-2">
                <p className="font-bold text-slate-700 dark:text-gray-200 text-sm whitespace-nowrap overflow-hidden text-ellipsis">
                  {alert.type}
                </p>
              </div>

              { }
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                { }
                <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatThaiTime(alert.timestamp)} น.
                </span>

                { }
                {isAck ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-orange-500 font-medium">กำลังช่วยเหลือ</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-red-500 font-medium animate-pulse">เกิดเหตุ!</span>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}