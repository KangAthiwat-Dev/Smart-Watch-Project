"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { FileText } from "lucide-react";
import TransactionModal from "./transaction-modal";

const getStatusBadge = (status: string, view: "borrow" | "return") => {
    if (view === "borrow" && ["RETURN_PENDING", "RETURNED", "RETURN_FAILED"].includes(status)) {
      if (status === "RETURNED") return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">คืนสำเร็จแล้ว</Badge>;
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">อนุมัติแล้ว</Badge>;
    }
    switch (status) {
      case "PENDING": return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-yellow-200">รออนุมัติ</Badge>;
      case "APPROVED": return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">อนุมัติแล้ว</Badge>;
      case "REJECTED": return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200">ไม่อนุมัติ</Badge>;
      case "RETURN_PENDING": return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200 animate-pulse">รอตรวจสอบคืน</Badge>;
      case "RETURNED": return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">คืนสำเร็จ</Badge>;
      case "RETURN_FAILED": return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200">คืนไม่สำเร็จ</Badge>;
      default: return <Badge variant="default">ไม่ระบุ</Badge>;
    }
};

interface TransactionListProps {
  data: any[];
  view: "borrow" | "return";
}

export default function TransactionList({ data, view }: TransactionListProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = (id: number) => {
    setSelectedId(id);
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setSelectedId(null);
  };

  return (
    <>
      <TransactionModal 
        transactionId={selectedId} 
        isOpen={isOpen} 
        onClose={handleClose} 
        view={view}
      />

      <div className="overflow-auto h-[calc(100vh-420px)] relative scroll-smooth">
        <table className="w-full text-sm text-left">
          
          <thead className="sticky top-0 z-10 bg-gray-50 text-gray-600 font-bold border-b border-gray-200 shadow-sm">
            <tr>
              <th className="px-6 py-4 w-[60px]">#</th>
              <th className="px-6 py-4">ชื่อ-สกุล (ผู้ยืม)</th>
              <th className="px-6 py-4">ชื่อ-สกุล (ผู้ที่มีภาวะพึ่งพิง)</th>
              <th className="px-6 py-4">วันที่{view === "borrow" ? "ยื่นคำขอ" : "คืน"}</th>
              <th className="px-6 py-4 text-center">สถานะ</th>
              <th className="px-6 py-4">อุปกรณ์</th>
              <th className="px-6 py-4 text-right">จัดการ</th>
            </tr>
          </thead>
          
          <tbody className="divide-y divide-gray-100">
            {data.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-16 text-center text-gray-400 bg-white">
                  <FileText className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  ไม่พบข้อมูลรายการ
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <tr key={item.id} className="hover:bg-blue-50/30 transition-colors bg-white group">
                  <td className="px-6 py-4 text-gray-400 font-mono text-xs">#{item.id}</td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-800">{item.borrower.firstName} {item.borrower.lastName}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{item.borrower.phone || "-"}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {item.dependent.firstName} {item.dependent.lastName}
                  </td>
                  <td className="px-6 py-4 text-slate-600 font-medium">
                    {format(new Date(item.borrowDate), "d MMM yyyy", { locale: th })}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {getStatusBadge(item.status, view)}
                  </td>
                  <td className="px-6 py-4">
                    {item.items.length > 0 ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {item.items[0].equipment.name}
                        {item.items.length > 1 && ` (+${item.items.length - 1})`}
                      </span>
                    ) : "-"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleOpen(item.id)}
                        className="text-blue-600 hover:text-blue-800 border-blue-200 hover:bg-blue-50 h-8 shadow-sm"
                    >
                        รายละเอียด
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}