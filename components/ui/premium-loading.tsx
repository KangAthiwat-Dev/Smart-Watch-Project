'use client';

import { Loader2, ShieldCheck } from 'lucide-react';

export function PremiumLoading({ text = "กำลังโหลดข้อมูล..." }: { text?: string }) {
    return (
        <div className="min-h-screen relative flex flex-col items-center justify-center overflow-hidden bg-slate-50 font-sans">

            {/* Abstract Background Effects */}
            <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse delay-700" />

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

                    {/* Floating Particles */}
                    <div className="absolute -top-2 left-1/2 w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-100"></div>
                </div>

                <h1 className="text-3xl font-black bg-gradient-to-br from-slate-700 to-slate-400 bg-clip-text text-transparent tracking-tight mb-2">
                    AFE PLUS
                </h1>
                <div className="flex items-center gap-2">
                    <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
                    <p className="text-slate-400 text-xs font-semibold tracking-widest uppercase">{text}</p>
                </div>

            </div>

            {/* Footer Branding */}
            <div className="absolute bottom-10 text-center opacity-30">
                <p className="text-[10px] font-bold tracking-[0.2em] text-slate-900">SECURE ACCESS</p>
            </div>

        </div>
    );
}
