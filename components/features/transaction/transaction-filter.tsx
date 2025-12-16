"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RotateCcw, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TransactionFilterProps {
  view: "borrow" | "return";
}

export default function TransactionFilter({ view }: TransactionFilterProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();

  // ดึงค่าจาก URL มาใส่ใน State เริ่มต้น
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "");

  // ✅ 1. Logic สำหรับการพิมพ์ค้นหา (Debounce)
  // รอให้หยุดพิมพ์ 300ms ค่อยยิงค้นหา (กันกระตุก)
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      handleSearch(searchTerm, status);
    }, 200);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]); 

  // ✅ 2. ฟังก์ชันอัปเดต URL (หัวใจหลัก)
  const handleSearch = (term: string, currentStatus: string) => {
    const params = new URLSearchParams(searchParams);
    
    // ตั้งค่า View เสมอ (กันหลุด)
    params.set("view", view);

    // จัดการ Search Text
    if (term) {
      params.set("search", term);
    } else {
      params.delete("search");
    }

    // จัดการ Status
    if (currentStatus) {
      params.set("status", currentStatus);
    } else {
      params.delete("status");
    }

    // สั่งเปลี่ยน URL (replace = ไม่เก็บประวัติย้อนหลัง ให้รก browser)
    replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // ✅ 3. เมื่อเลือก Status ให้ค้นหาทันที (ไม่ต้องรอ delay)
  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    handleSearch(searchTerm, newStatus); // ส่งค่า search เดิมไปด้วย
  };

  // ✅ 4. ปุ่ม Reset
  const handleReset = () => {
    setSearchTerm("");
    setStatus("");
    replace(`${pathname}?view=${view}`, { scroll: false });
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
          
          {/* ช่องค้นหาชื่อ (กินพื้นที่ 6 ส่วน) */}
          <div className="space-y-2 md:col-span-6">
            <label className="text-sm font-bold text-gray-700">ค้นหา (ชื่อผู้ยืม / ผู้ที่มีภาวะพึ่งพิง)</label>
            <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <Input 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)} // พิมพ์แล้ว update state -> รอ useEffect ทำงาน
                    placeholder="ระบุชื่อ-นามสกุล..." 
                    className="pl-9 bg-white h-10" 
                />
            </div>
          </div>

          {/* Dropdown สถานะ (กินพื้นที่ 4 ส่วน) */}
          <div className="space-y-2 md:col-span-4">
            <label className="text-sm font-bold text-gray-700">สถานะ</label>
            <select
              value={status}
              onChange={(e) => handleStatusChange(e.target.value)} // เลือกปุ๊บ เปลี่ยนปั๊บ
              className="flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">ทั้งหมด</option>
              {view === "borrow" ? (
                <>
                  <option value="PENDING">รออนุมัติ</option>
                  <option value="APPROVED">อนุมัติแล้ว</option>
                  <option value="REJECTED">ไม่อนุมัติ</option>
                </>
              ) : (
                <>
                  <option value="RETURN_PENDING">รอตรวจสอบคืน</option>
                  <option value="RETURNED">คืนสำเร็จ</option>
                  <option value="RETURN_FAILED">คืนไม่สำเร็จ</option>
                </>
              )}
            </select>
          </div>

          {/* ปุ่ม Reset (กินพื้นที่ 2 ส่วน) */}
          <div className="md:col-span-2">
            <Button 
                type="button" 
                variant="outline" 
                onClick={handleReset}
                className="w-full h-10 border-gray-300 text-gray-500 hover:text-gray-700 bg-white"
            >
              <RotateCcw className="w-4 h-4 mr-2" /> ล้างค่า
            </Button>
          </div>

        </div>
      </CardContent>
    </Card>
  );
}