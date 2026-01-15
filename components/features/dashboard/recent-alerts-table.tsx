"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { AlertTriangle } from "lucide-react";

interface RecentAlertsTableProps {
  alerts: any[];
}


export default function RecentAlertsTable({ alerts }: RecentAlertsTableProps) {


  const getAlertConfig = (type: string) => {
    switch (type) {
      case 'SOS':
        return { label: 'ขอความช่วยเหลือ', color: 'bg-red-100 text-red-700 border-red-200' };
      case 'FALL':
        return { label: 'ตรวจพบการล้ม', color: 'bg-orange-100 text-orange-700 border-orange-200' };
      case 'HEART_RATE':
        return { label: 'อัตราการเต้นหัวใจผิดปกติ', color: 'bg-rose-100 text-rose-700 border-rose-200' };
      default:
        return { label: 'แจ้งเตือนทั่วไป', color: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  return (
    <Card className="rounded-2xl shadow-sm border border-slate-100 dark:border-gray-700 bg-white dark:bg-gray-800 transition-colors duration-300">
      <CardHeader className="pb-4 border-b border-slate-50 dark:border-gray-700 mb-4">
        <CardTitle className="text-lg font-bold text-slate-800 dark:text-gray-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center border border-orange-100 dark:border-orange-900/30">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
          </div>
          การแจ้งเตือนล่าสุด
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[150px]">เวลา</TableHead>
              <TableHead>ผู้ที่มีภาวะพึ่งพิง</TableHead>
              <TableHead>เหตุการณ์</TableHead>
              <TableHead className="text-right">สถานะ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alerts.length > 0 ? (
              alerts.map((alert) => {

                const config = getAlertConfig(alert.type);

                return (
                  <TableRow key={alert.id} className="hover:bg-slate-50/60 dark:hover:bg-gray-700/50 border-b border-slate-100 dark:border-gray-700">
                    <TableCell className="font-medium text-slate-600 dark:text-gray-400">
                      { }
                      {format(new Date(alert.createdAt || alert.timestamp), "dd MMM HH:mm", {
                        locale: th,
                      })}
                    </TableCell>
                    <TableCell className="font-bold text-slate-700 dark:text-gray-200">
                      {alert.dependent?.firstName} {alert.dependent?.lastName}
                    </TableCell>
                    <TableCell>
                      { }
                      <Badge variant="default" className={`${config.color} border font-medium`}>
                        {config.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      { }
                      <span className={`text-xs font-bold ${alert.status === 'ACKNOWLEDGED' ? 'text-green-600' : 'text-red-500 animate-pulse'}`}>
                        {alert.status === 'ACKNOWLEDGED' ? 'รับเรื่องแล้ว' : 'รอการตรวจสอบ'}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground py-8"
                >
                  ไม่มีการแจ้งเตือน
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}