"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

interface ViewSwitcherProps {
  currentView: "borrow" | "return";
}

export default function ViewSwitcher({ currentView }: ViewSwitcherProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSwitch = (view: "borrow" | "return") => {
    if (view === currentView) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set("view", view);
    
    // ✅ ไม่ต้องใช้ startTransition แล้ว สั่งเปลี่ยนเลย เดี๋ยว Suspense ที่หน้า Page จะทำงานเอง
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm flex">
      <button
        onClick={() => handleSwitch("borrow")}
        className={cn(
          "px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
          currentView === "borrow"
            ? "bg-blue-600 text-white shadow-md"
            : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
        )}
      >
        รายการยืม
      </button>

      <button
        onClick={() => handleSwitch("return")}
        className={cn(
          "px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
          currentView === "return"
            ? "bg-blue-600 text-white shadow-md"
            : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
        )}
      >
        รายการคืน
      </button>
    </div>
  );
}