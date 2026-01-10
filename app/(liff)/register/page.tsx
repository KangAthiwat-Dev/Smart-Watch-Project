'use client';

import { useEffect, useState } from 'react';
import liff from '@line/liff';
import { Loader2, AlertTriangle, RefreshCcw } from 'lucide-react';
import { checkLiffUserStatus } from '@/actions/liff-auth.actions';

export default function RegisterRedirectPage() {

  const [debugLog, setDebugLog] = useState<string>('กำลังเริ่มต้น...');
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const redirectUser = async () => {
      try {
        setDebugLog('Init LIFF...');
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID || '' });
        
        setDebugLog('Checking Login...');
        if (!liff.isLoggedIn()) {
          setDebugLog('Need Login...');
          liff.login();
          return;
        }

        setDebugLog('Get Profile...');
        const profile = await liff.getProfile();
        
        setDebugLog(`Checking DB for: ${profile.userId.substring(0, 5)}...`);
        const status = await checkLiffUserStatus(profile.userId);
        
        setDebugLog(`Result: ${status}`);

        if (status === 'UNREGISTERED') {
            window.location.href = '/register/caregiver';
        } else {
            window.location.href = '/register/dependent';
        }

      } catch (error: any) {
        console.error(error);
        setIsError(true);
        setDebugLog(` Error: ${error.message || JSON.stringify(error)}`);
      }
    };

    redirectUser();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
      
      {!isError ? (
        <>
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
            <h2 className="text-gray-700 font-bold mb-2">กำลังตรวจสอบข้อมูล...</h2>
            <p className="text-xs text-gray-400 font-mono bg-gray-100 p-2 rounded max-w-xs break-all">
                {debugLog}
            </p>
        </>
      ) : (
        <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-red-600 font-bold text-lg mb-2">เกิดข้อผิดพลาด</h2>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-red-100 w-full mb-6">
                <p className="text-xs text-red-400 font-mono text-left break-all">
                    {debugLog}
                </p>
            </div>
            
            <button 
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg active:scale-95 transition-all"
            >
                <RefreshCcw className="w-4 h-4" /> ลองใหม่อีกครั้ง
            </button>
        </>
      )}

    </div>
  );
}