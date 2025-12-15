import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Search, RotateCcw, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import TransactionModal from "@/components/features/transaction/transaction-modal";
import { getTransactionById } from "@/actions/equipment.actions";

// --- 1. Logic การดึงข้อมูล ---
async function getTransactions(
  view: "borrow" | "return",
  search?: string,
  status?: string
) {
  let statusFilter: any = {};

  // กำหนด Filter ตาม Tab ที่เลือก
  if (view === "borrow") {
    if (status) {
      if (status === "APPROVED") {
        // ถ้าเลือก "อนุมัติแล้ว" ให้รวมสถานะการคืนเข้าไปด้วย (เพราะถือว่าผ่านการอนุมัติยืมมาแล้ว)
        statusFilter = {
          status: {
            in: ["APPROVED", "RETURN_PENDING", "RETURNED", "RETURN_FAILED"],
          },
        };
      } else {
        statusFilter = { status: status };
      }
    } else {
      // หน้า Borrow แสดงสถานะเหล่านี้
      statusFilter = {
        status: {
          in: [
            "PENDING",
            "APPROVED",
            "REJECTED",
            "RETURN_PENDING",
            "RETURNED",
            "RETURN_FAILED",
          ],
        },
      };
    }
  } else {
    // หน้า Return
    if (status) {
      statusFilter = { status: status };
    } else {
      // หน้า Return Default แสดงสถานะเหล่านี้
      statusFilter = {
        status: {
          in: ["RETURN_PENDING", "RETURNED", "RETURN_FAILED"],
        },
      };
    }
  }

  // Query Database
  const items = await prisma.borrowEquipment.findMany({
    where: {
      ...statusFilter,
      OR: search
        ? [
            {
              borrower: {
                firstName: { contains: search, mode: "insensitive" }, // ค้นหาชื่อคนยืม
              },
            },
            {
              borrower: { lastName: { contains: search, mode: "insensitive" } },
            },
            {
              dependent: {
                firstName: { contains: search, mode: "insensitive" }, // ค้นหาชื่อผู้สูงอายุ
              },
            },
          ]
        : undefined,
    },
    include: {
      borrower: true,
      dependent: true,
      items: {
        include: {
          equipment: true,
        },
      },
    },
    orderBy: { createdAt: "desc" }, // เรียงจากใหม่ไปเก่า
  });

  return items;
}

// --- 2. Helper: แสดง Badge สถานะ ---
const getStatusBadge = (status: string, view: "borrow" | "return") => {
  // ถ้าอยู่ในหน้า Borrow แต่สถานะเป็น Return แล้ว ให้โชว์ว่า "อนุมัติแล้ว" (จะได้ไม่งง)
  if (
    view === "borrow" &&
    ["RETURN_PENDING", "RETURNED", "RETURN_FAILED"].includes(status)
  ) {
    if (status === "RETURNED") {
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">คืนสำเร็จแล้ว</Badge>;
    }
    return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">อนุมัติแล้ว</Badge>;
  }
  
  switch (status) {
    // Borrow Status
    case "PENDING":
      return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-yellow-200">รออนุมัติ</Badge>;
    case "APPROVED":
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">อนุมัติแล้ว</Badge>;
    case "REJECTED":
      return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200">ไม่อนุมัติ</Badge>;

    // Return Status
    case "RETURN_PENDING":
      return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200 animate-pulse">รอตรวจสอบคืน</Badge>;
    case "RETURNED":
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">คืนสำเร็จ</Badge>;
    case "RETURN_FAILED":
      return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200">คืนไม่สำเร็จ</Badge>;

    default:
      return <Badge variant="default">ไม่ระบุ</Badge>;
  }
};

// --- 3. Main Component ---
export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    search?: string;
    status?: string;
    transactionId?: string;
  }>;
}) {
  const params = await searchParams;
  const currentView = (params.view as "borrow" | "return") || "borrow";
  const searchText = params.search || "";
  const selectedStatus = params.status || "";
  const transactionId = params.transactionId;

  // ดึงข้อมูลรายการ
  const transactions = await getTransactions(
    currentView,
    searchText,
    selectedStatus
  );

  // ดึงข้อมูลรายการเดียว (สำหรับ Modal)
  let selectedTransaction = null;
  if (transactionId) {
    const res = await getTransactionById(parseInt(transactionId));
    if (res.success) {
      selectedTransaction = res.data;
    }
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Modal - ส่งข้อมูลไปแสดงผล */}
      <TransactionModal
        transaction={selectedTransaction}
        isOpen={!!selectedTransaction}
        // onClose ถูกจัดการโดย Link ใน Modal component
        onClose={async () => { "use server"; }}
        view={currentView}
      />

      {/* Header & Tabs Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {currentView === "borrow" ? "รายการยืมครุภัณฑ์" : "รายการคืนครุภัณฑ์"}
          </h1>
          <p className="text-gray-600 mt-1">
            {currentView === "borrow" ? "จัดการคำขอยืมและอนุมัติ" : "ตรวจสอบและยืนยันการคืนอุปกรณ์"}
          </p>
        </div>

        {/* ปุ่มสลับ Tab */}
        <div className="bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm flex">
          <Link href="/admin/transactions?view=borrow" scroll={false}>
            <div className={cn(
                "px-6 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer flex items-center gap-2",
                currentView === "borrow" ? "bg-blue-600 text-white shadow-md" : "text-gray-500 hover:bg-gray-50"
              )}>
              รายการยืม
            </div>
          </Link>
          <Link href="/admin/transactions?view=return" scroll={false}>
            <div className={cn(
                "px-6 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer flex items-center gap-2",
                currentView === "return" ? "bg-blue-600 text-white shadow-md" : "text-gray-500 hover:bg-gray-50"
              )}>
              รายการคืน
            </div>
          </Link>
        </div>
      </div>

      {/* Filter Section */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b bg-gray-50/50">
          <CardTitle className="text-base font-semibold text-gray-700">ตัวกรองข้อมูล</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <form className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
            <input type="hidden" name="view" value={currentView} />

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-bold text-gray-700">ค้นหา (ชื่อผู้ยืม / ผู้สูงอายุ)</label>
              <Input name="search" defaultValue={searchText} placeholder="ระบุชื่อ-นามสกุล..." className="bg-white h-10" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">สถานะ</label>
              <select name="status" defaultValue={selectedStatus} className="flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">ทั้งหมด</option>
                {currentView === "borrow" ? (
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

            <div className="flex gap-2">
              <Button type="submit" className="bg-orange-500 hover:bg-orange-600 text-white w-full h-10 shadow-sm">
                <Search className="w-4 h-4 mr-2" /> ค้นหา
              </Button>
              <Link href={`/admin/transactions?view=${currentView}`}>
                <Button type="button" variant="outline" className="px-3 h-10 border-gray-300">
                  <RotateCcw className="w-4 h-4 text-gray-500" />
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Table Section */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 w-[60px]">#</th>
                <th className="px-6 py-4">ชื่อ-สกุล (ผู้ยืม)</th>
                <th className="px-6 py-4">ชื่อ-สกุล (ผู้พึ่งพิง)</th>
                <th className="px-6 py-4">วันที่{currentView === "borrow" ? "ยื่นคำขอ" : "คืน"}</th>
                <th className="px-6 py-4 text-center">สถานะ</th>
                <th className="px-6 py-4">อุปกรณ์</th>
                <th className="px-6 py-4 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-gray-400 bg-white">
                    <FileText className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    ไม่พบข้อมูลรายการ
                  </td>
                </tr>
              ) : (
                transactions.map((item) => (
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
                      {getStatusBadge(item.status, currentView)}
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
                      {/* ปุ่มกดเปิด Modal */}
                      <Link href={`/admin/transactions?view=${currentView}&transactionId=${item.id}`} scroll={false}>
                        <Button variant="outline" size="sm" className="text-blue-600 hover:text-blue-800 border-blue-200 hover:bg-blue-50 h-8 shadow-sm">
                          รายละเอียด
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}