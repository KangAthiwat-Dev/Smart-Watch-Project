import { LoginForm } from '@/components/features/auth/login-form';
import { Activity } from 'lucide-react'; // ✅ เปลี่ยนจาก Shield เป็น Activity

// ✅ เพิ่มเพื่อไม่ให้ cache
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-yellow-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          
          {/* ✅ ส่วนที่แก้: เปลี่ยนเป็น Icon วงแหวนหัวใจ (Custom Design) */}
          <div className="relative w-24 h-24 mx-auto mb-6 flex items-center justify-center rounded-full bg-white shadow-xl ring-4 ring-white/50">
             
             {/* 1. วงแหวน Spinner (แต่งด้วย Tailwind) */}
             <div className="absolute inset-0 w-full h-full rounded-full border-[8px] border-slate-100 border-t-blue-600 rotate-45"></div>
             
             {/* 2. ไอคอนหัวใจตรงกลาง */}
             <Activity className="relative z-10 w-10 h-10 text-blue-600" strokeWidth={2.5} />
             
          </div>

          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            เข้าสู่ระบบผู้ดูแล
          </h1>
          <p className="text-gray-600">
            AFE Plus Monitoring System
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <LoginForm />
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          © 2025 AFE Plus Monitoring System. All rights reserved.
        </p>
      </div>
    </div>
  );
}