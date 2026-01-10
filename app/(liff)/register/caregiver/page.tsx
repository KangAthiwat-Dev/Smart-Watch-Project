'use client';

import { useEffect, useState } from 'react';
import liff from '@line/liff';
import { checkLiffUserStatus } from '@/actions/liff-auth.actions';
import { CaregiverRegisterForm } from '@/components/features/registers/caregiver-register-form';
import { Loader2 } from 'lucide-react';

export default function UserRegisterPage() {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        await liff.init({ 
            liffId: process.env.NEXT_PUBLIC_LIFF_ID || '',
            withLoginOnExternalBrowser: true 
        });

        if (!liff.isLoggedIn()) {
             liff.login(); 
             return;
        }
        
        const profile = await liff.getProfile();
        const status = await checkLiffUserStatus(profile.userId);

        if (status === 'NO_ELDERLY') {
            window.location.href = '/register/dependent';
            return;
        } else if (status === 'COMPLETE') {
            window.location.href = '/safety-settings';
            return;
        } 
        
        setChecking(false);

      } catch (e) { 
        setChecking(false); 
      }
    };
    check();
  }, []);

  if (checking) return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600 w-10 h-10" /></div>;

  return <CaregiverRegisterForm />;
}