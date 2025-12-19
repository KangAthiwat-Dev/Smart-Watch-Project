'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Watch,
  AlertTriangle,
  Settings,
  UserCog,
  Package,
  ArrowLeftRight,
} from 'lucide-react';
// ✅ Import Action ที่เราเพิ่งสร้าง
import { getSidebarCounts, markAsViewed } from '@/actions/sidebar.actions';

interface SidebarProps {
  isOpen: boolean;
}

export function Sidebar({ isOpen }: SidebarProps) {
  const pathname = usePathname();
  
  // ✅ State เก็บตัวเลข 4 หมวด
  const [counts, setCounts] = useState({
    alerts: 0,
    transactions: 0, // ยืม-คืน
    caregivers: 0,   // ผู้ดูแลใหม่
    dependents: 0,   // ผู้พึ่งพิงใหม่
  });

  // ฟังก์ชันดึงข้อมูลล่าสุด
  const fetchCounts = async () => {
    try {
        const res = await getSidebarCounts();
        setCounts(res);
    } catch (e) {
        console.error(e);
    }
  };

  // 1. ดึงข้อมูลเมื่อโหลดหน้าเว็บ
  useEffect(() => {
    fetchCounts();

    // Listener เผื่อมีการอัปเดตแบบ Realtime (ถ้ามี)
    const handleAlertUpdate = () => fetchCounts();
    window.addEventListener('alert-update', handleAlertUpdate);
    
    // ตั้ง Interval เช็คทุก 30 วินาที (Optional: เพื่อความสดใหม่)
    const interval = setInterval(fetchCounts, 30000);

    return () => {
        window.removeEventListener('alert-update', handleAlertUpdate);
        clearInterval(interval);
    };
  }, []);

  // 2. Logic ล้างเลขแจ้งเตือนเมื่อกดเข้ามาดูหน้า (เฉพาะ Users)
  useEffect(() => {
    const checkAndClearBadge = async () => {
        // ถ้าอยู่หน้าผู้ดูแล และมีเลขค้าง -> ล้างออก
        if (pathname === '/admin/caregivers' && counts.caregivers > 0) {
            await markAsViewed('caregivers');
            setCounts(prev => ({ ...prev, caregivers: 0 }));
        }
        
        // ถ้าอยู่หน้าผู้พึ่งพิง และมีเลขค้าง -> ล้างออก
        if (pathname === '/admin/dependents' && counts.dependents > 0) {
            await markAsViewed('dependents');
            setCounts(prev => ({ ...prev, dependents: 0 }));
        }
    };
    
    checkAndClearBadge();
    
    // หมายเหตุ: หน้า Alerts และ Transactions จะไม่ล้างตอนกดเข้า
    // เพราะมันควรจะหายไปเมื่อเรากด "จัดการ/อนุมัติ" งานเสร็จแล้ว (Auto Refresh)
  }, [pathname, counts.caregivers, counts.dependents]);

  const menuItems = [
    {
      title: 'Dashboard',
      href: '/admin/dashboard',
      icon: LayoutDashboard,
    },
    {
      title: 'ผู้ดูแล',
      href: '/admin/caregivers',
      icon: Users,
      badge: counts.caregivers, // ✅ Badge คนใหม่
    },
    {
      title: 'ผู้ที่มีภาวะพึ่งพิง',
      href: '/admin/dependents',
      icon: UserCog,
      badge: counts.dependents, // ✅ Badge คนใหม่
    },
    {
      title: 'การแจ้งเตือน',
      href: '/admin/alerts',
      icon: AlertTriangle,
      badge: counts.alerts, // ✅ Badge SOS
    },
    {
      title: 'คลังอุปกรณ์', 
      href: '/admin/equipment',
      icon: Package,
    },
    {
      title: 'ระบบยืม-คืน',
      href: '/admin/transactions',
      icon: ArrowLeftRight,
      badge: counts.transactions, // ✅ Badge งานรออนุมัติ (ยืม+คืน)
    },
    {
      title: 'ติดตาม Real-time',
      href: '/admin/monitoring',
      icon: Watch,
    },
    {
      title: 'ตั้งค่า',
      href: '/admin/settings',
      icon: Settings,
    },
  ];

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" />
      )}

      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-50 w-64 bg-gray-900 text-white transform transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-gray-800">
            <h2 className="text-2xl font-bold">AFE PLUS</h2>
            <p className="text-sm text-gray-400 mt-1">Monitoring System</p>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center justify-between px-4 py-3 rounded-lg transition-colors group',
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  )}
                >
                  <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{item.title}</span>
                  </div>
                  
                  {/* ✅ แสดง Badge (จุดแดง) ถ้ามีตัวเลข */}
                  {item.badge !== undefined && item.badge > 0 && (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white animate-pulse shadow-sm shadow-red-900">
                          {item.badge > 99 ? '99+' : item.badge}
                      </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-gray-800">
            <p className="text-xs text-gray-400 text-center">
              Version 2.0.0
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}