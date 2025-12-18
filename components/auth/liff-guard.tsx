'use client';

import { useEffect, useState } from 'react';
import liff from '@line/liff';
import { useRouter, usePathname } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { checkLiffUserStatus } from '@/actions/liff-auth.actions';
import { setAuthCookie } from '@/actions/auth-cookie.actions';

export default function LiffGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        // 1. Init LIFF พร้อมระบบกู้ชีพ
        try {
            await liff.init({ 
                liffId: process.env.NEXT_PUBLIC_LIFF_ID || '',
                withLoginOnExternalBrowser: true 
            });
        } catch (liffError: any) {
            console.error("LIFF Init Error:", liffError);
            if (
                liffError.message?.includes('code_verifier') || 
                liffError.code === '400' ||
                liffError.message?.includes('compare')
            ) {
                console.warn("🧹 Cleaning up stale login data...");
                localStorage.clear();
                sessionStorage.clear();
                const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
                window.location.replace(cleanUrl); 
                return;
            }
        }

        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        const profile = await liff.getProfile();
        await setAuthCookie(profile.userId);
        const status = await checkLiffUserStatus(profile.userId);

        // Logic การเด้งหน้า
        if (status === 'UNREGISTERED') {
            if (pathname !== '/register/user') router.replace('/register/user');
            else setIsChecking(false);
        } else if (status === 'NO_ELDERLY') {
            if (pathname !== '/register/elderly') router.replace('/register/elderly');
            else setIsChecking(false);
        } else {
            // COMPLETE
            setIsChecking(false);
            router.refresh();
        }

      } catch (error) {
        console.error("Guard Error:", error);
        setIsChecking(false); 
      }
    };

    check();
  }, [router, pathname]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-white px-6 font-sans">
        
        {/* Logo Animation */}
        <div className="relative mb-8">
            {/* แสงด้านหลัง */}
            <div className="absolute inset-0 bg-blue-500 rounded-full blur-2xl opacity-20 animate-pulse"></div>
            
            {/* กล่องไอคอน */}
            <div className="relative w-24 h-24 bg-white rounded-3xl shadow-xl shadow-blue-100 flex items-center justify-center border border-white">
                <ShieldCheck className="w-12 h-12 text-blue-600 drop-shadow-sm" strokeWidth={1.5} />
            </div>
        </div>

        {/* Text Branding */}
        <div className="text-center space-y-1 mb-12">
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">AFE PLUS</h1>
            <p className="text-slate-400 text-xs font-bold tracking-[0.2em] uppercase">Smart Safety System</p>
        </div>

        {/* Custom Loading Spinner */}
        <div className="flex flex-col items-center gap-4">
            <div className="relative h-10 w-10">
                <div className="absolute h-full w-full rounded-full border-4 border-slate-100"></div>
                <div className="absolute h-full w-full rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
            </div>
            <p className="text-slate-500 text-sm font-medium animate-pulse">กำลังตรวจสอบสิทธิ์...</p>
        </div>

        {/* Footer Credit (Optional) */}
        <div className="absolute bottom-8 text-[10px] text-slate-300">
            SECURE CONNECTION
        </div>

      </div>
    );
  }

  return <>{children}</>;
}