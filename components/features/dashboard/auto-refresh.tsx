"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [router]);

  return null;
}