'use client';

import { useEffect, useState } from 'react';
import liff from '@line/liff';
import { Loader2, AlertTriangle, RefreshCcw, ShieldCheck } from 'lucide-react';
import { checkLiffUserStatus } from '@/actions/liff-auth.actions';

export default function RegisterRedirectPage() {

  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const redirectUser = async () => {
      try {
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID || '' });

        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        const profile = await liff.getProfile();
        const status = await checkLiffUserStatus(profile.userId);

        if (status === 'UNREGISTERED') {
          window.location.href = '/register/caregiver';
        } else {
          window.location.href = '/register/dependent';
        }

      } catch (error: any) {
        console.error(error);
        // Attempt recovery from potential stalled token/permission issues
        try {
          if (liff.isLoggedIn()) {
            liff.logout();
          }
          liff.login();
        } catch (e) {
          setIsError(true);
        }
      }
    };

    redirectUser();
  }, []);

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center overflow-hidden bg-slate-50 font-sans">

      {/* Abstract Background Effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse delay-700" />

      {!isError ? (
        <div className="relative z-10 flex flex-col items-center">

          {/* Premium Loader Design */}
          <div className="relative w-32 h-32 flex items-center justify-center mb-8">
            {/* Outer Ring */}
            <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
            {/* Spinning Gradient Ring */}
            <div className="absolute inset-0 border-4 border-transparent border-t-blue-600 border-r-indigo-600 rounded-full animate-spin"></div>

            {/* Inner Pulsing Circle */}
            <div className="absolute inset-4 bg-white/50 backdrop-blur-3xl rounded-full shadow-2xl flex items-center justify-center animate-pulse">
              <ShieldCheck className="w-10 h-10 text-slate-700 opacity-20" />
            </div>

            {/* Floating Particles (Optional CSS trick) */}
            <div className="absolute -top-2 left-1/2 w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-100"></div>
          </div>

          <h1 className="text-3xl font-black bg-gradient-to-br from-slate-700 to-slate-400 bg-clip-text text-transparent tracking-tight mb-2">
            AFE PLUS
          </h1>
          <div className="flex items-center gap-2">
            <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
            <p className="text-slate-400 text-xs font-semibold tracking-widest uppercase">กำลังตรวจสอบข้อมูล</p>
          </div>

        </div>
      ) : (
        <div className="relative z-10 flex flex-col items-center max-w-sm px-6 text-center">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-red-500/10 ring-8 ring-white">
            <AlertTriangle className="w-10 h-10 text-red-500" />
          </div>

          <h2 className="text-2xl font-bold text-slate-800 mb-2">เกิดข้อผิดพลาด</h2>
          <p className="text-slate-500 text-sm mb-10 leading-relaxed font-medium">
            ไม่สามารถเชื่อมต่อกับระบบได้ <br /> กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง
          </p>

          <button
            onClick={() => window.location.reload()}
            className="group relative w-full py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-xl shadow-slate-900/20 active:scale-95 transition-all overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative flex items-center justify-center gap-2">
              <RefreshCcw className="w-4 h-4" />
              <span>ลองใหม่อีกครั้ง</span>
            </div>
          </button>
        </div>
      )}

      {/* Footer Branding */}
      <div className="absolute bottom-10 text-center opacity-30">
        <p className="text-[10px] font-bold tracking-[0.2em] text-slate-900">SECURE ACCESS</p>
      </div>

    </div>
  );
}