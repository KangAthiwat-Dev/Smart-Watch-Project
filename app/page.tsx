'use client';

import { useState, useEffect } from 'react';
import Link from "next/link";
import { useRouter } from 'next/navigation';
import liff from '@line/liff';
import { siteConfig } from '@/config/site';
import { ShieldCheck, ArrowRight, Loader2, Activity } from 'lucide-react';
import { checkLiffUserStatus } from '@/actions/liff-auth.actions';

export default function Home() {
  const router = useRouter();
  const [isCheckingLiff, setIsCheckingLiff] = useState(true);

  useEffect(() => {
    const checkDispatcher = async () => {
      try {
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID || '' });

        if (liff.isInClient()) {
            if (!liff.isLoggedIn()) {
                liff.login();
                return;
            }
            const profile = await liff.getProfile();
            const status = await checkLiffUserStatus(profile.userId);

            if (status === 'UNREGISTERED') {
                router.replace('/register/caregiver');
            } else if (status === 'NO_ELDERLY') {
                router.replace('/register/dependent');
            } else {
                router.replace('/safety-settings');
            }
            return; 
        } 
        
        setIsCheckingLiff(false);

      } catch (error) {
        console.error("LIFF/Dispatch Error:", error);
        setIsCheckingLiff(false);
      }
    };

    checkDispatcher();
  }, [router]);

  if (isCheckingLiff) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
        <p className="text-slate-500 text-sm font-medium">กำลังตรวจสอบการเชื่อมต่อ...</p>
      </div>
    );
  }

  return (
    <main className="relative flex flex-col items-center justify-center min-h-screen overflow-hidden bg-slate-50 selection:bg-blue-500 selection:text-white">
      
      <div className="absolute inset-0 -z-10 h-full w-full bg-white bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] bg-[size:6rem_4rem]">
        <div className="absolute bottom-0 left-0 right-0 top-0 bg-[radial-gradient(circle_800px_at_100%_200px,#d5c5ff,transparent)]"></div>
      </div>

      <div className="relative w-full max-w-lg px-6">
        <div className="group relative overflow-hidden rounded-[2.5rem] border border-white/50 bg-white/60 p-10 shadow-2xl backdrop-blur-xl transition-all hover:shadow-blue-200/50">
          
          <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-blue-400/20 blur-3xl group-hover:bg-blue-500/20 transition-colors duration-500"></div>
          
          <div className="relative flex flex-col items-center text-center">
            <div className="mb-8 relative flex h-32 w-32 items-center justify-center rounded-full bg-white shadow-xl ring-8 ring-white select-none z-10">
              
              <div className="absolute inset-0 h-full w-full rounded-full border-[12px] border-slate-100 border-t-blue-600 rotate-45 box-border"></div>
              
              <Activity className="h-14 w-14 text-blue-600 relative z-10" strokeWidth={2.5} />
              
            </div>

            <h1 className="mb-4 text-4xl font-black tracking-tight text-slate-800 sm:text-5xl">
              {siteConfig.name}
            </h1>
            
            <p className="mb-10 text-lg font-medium text-slate-500 leading-relaxed max-w-sm">
              {siteConfig.description}
              <br />
              <span className="text-sm text-slate-400 font-normal mt-2 block">
                ระบบติดตามและดูแลผู้ที่มีภาวะพึ่งพิงผ่าน Smart Watch
              </span>
            </p>

            <Link
              href="/admin/login"
              className="group/btn relative w-full overflow-hidden rounded-2xl bg-slate-900 p-4 transition-all hover:bg-blue-600 hover:scale-[1.02] hover:shadow-xl hover:shadow-blue-500/30 active:scale-95"
            >
              <div className="relative flex items-center justify-center gap-3">
                <span className="text-lg font-bold text-white tracking-wide">
                  เข้าสู่ระบบผู้ดูแล
                </span>
                <div className="rounded-full bg-white/20 p-1 transition-all group-hover/btn:translate-x-1 group-hover/btn:bg-white text-white group-hover/btn:text-blue-600">
                  <ArrowRight className="h-5 w-5" />
                </div>
              </div>
            </Link>

            <div className="mt-8 flex items-center gap-2 text-xs font-medium text-slate-400">
              <ShieldCheck className="h-4 w-4" />
              <span>Secure Monitoring System</span>
            </div>

          </div>
        </div>
      </div>
      
      <footer className="absolute bottom-6 text-center text-xs text-slate-400">
        © 2025 {siteConfig.name}. All rights reserved.
      </footer>

    </main>
  );
}