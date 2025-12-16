import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import ViewSwitcher from "@/components/features/transaction/view-switcher";
import TransactionFilter from "@/components/features/transaction/transaction-filter";
import TransactionTableSection from "@/components/features/transaction/transaction-table-section";
import TableLoading from "@/components/features/transaction/table-loading";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    search?: string;
    status?: string;
  }>;
}) {
  const params = await searchParams;
  const currentView = (params.view as "borrow" | "return") || "borrow";
  const searchText = params.search || "";
  const selectedStatus = params.status || "";

  // สร้าง Key เพื่อให้ Suspense รู้ว่าข้อมูลเปลี่ยนแล้วนะ (ต้อง Reload ใหม่)
  const suspenseKey = `${currentView}-${searchText}-${selectedStatus}`;

  return (
    <div className="space-y-5">
      
      {/* Header & View Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {currentView === "borrow" ? "รายการยืมครุภัณฑ์" : "รายการคืนครุภัณฑ์"}
          </h1>
          <p className="text-gray-600 mt-1">
            {currentView === "borrow" ? "จัดการคำขอยืมและอนุมัติ" : "ตรวจสอบและยืนยันการคืนอุปกรณ์"}
          </p>
        </div>
        <ViewSwitcher currentView={currentView} />
      </div>

      {/* Filter */}
      <TransactionFilter view={currentView} />

      {/* Table Section */}
      <Card className="border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
        {/* ✅ หัวใจสำคัญ: Suspense จะแสดง fallback (AdminLoading) เฉพาะตรงตารางนี้ */}
        <Suspense key={suspenseKey} fallback={<TableLoading />}>
           <TransactionTableSection 
              view={currentView} 
              search={searchText} 
              status={selectedStatus} 
           />
        </Suspense>
      </Card>
    </div>
  );
}