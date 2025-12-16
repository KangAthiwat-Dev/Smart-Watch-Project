import { Activity } from 'lucide-react';

export default function AdminLoading() {
  return (
    // ✅ เปลี่ยนจาก min-h-screen เป็น h-full เพื่อให้พอดีกับช่อง Content
    <div className="flex h-[calc(100vh-140px)] w-full flex-col items-center justify-center bg-white/50 backdrop-blur-sm">
      
      {/* Main Loader Component (ย่อขนาดลงนิดนึงจะได้ไม่แน่นเกิน) */}
      <div className="relative flex flex-col items-center scale-90">
        
        {/* Container ของวงกลม */}
        <div className="relative flex h-20 w-20 items-center justify-center">
            
            {/* A. วงแหวนเรดาร์ */}
            <div className="absolute inset-0 h-full w-full rounded-full bg-blue-400 opacity-20 animate-ping"></div>
            
            {/* B. วงกลมพื้นหลัง */}
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-white/50 bg-white/60 shadow-lg backdrop-blur-md">
                
                {/* C. ไอคอนหมุน */}
                <div className="absolute inset-0 h-full w-full animate-spin rounded-full border-4 border-slate-100 border-t-blue-600"></div>
                
                {/* D. ไอคอนหัวใจ */}
                <Activity className="h-6 w-6 text-blue-600" />
            </div>
        </div>

        {/* Text Content */}
        <div className="mt-6 flex flex-col items-center gap-1 text-center">
            <h2 className="text-base font-semibold text-slate-700">
                Loading...
            </h2>
            <p className="text-[10px] font-medium text-slate-400">
                กำลังโหลดข้อมูล
            </p>
        </div>

      </div>
    </div>
  );
}