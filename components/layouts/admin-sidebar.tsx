'use client';

import Link from 'next/link';
import Image from 'next/image';
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
import { getSidebarCounts, markAsViewed } from '@/actions/sidebar.actions';

interface SidebarProps {
  isOpen: boolean;
}

export function Sidebar({ isOpen }: SidebarProps) {
  const pathname = usePathname();
  
  const [counts, setCounts] = useState({
    alerts: 0,
    transactions: 0,
    caregivers: 0,
    dependents: 0,
  });

  const fetchCounts = async () => {
    try {
        const res = await getSidebarCounts();
        setCounts(res);
    } catch (e) {
        console.error(e);
    }
  };

  useEffect(() => {
    fetchCounts();

    const handleAlertUpdate = () => fetchCounts();
    window.addEventListener('alert-update', handleAlertUpdate);
    
    const interval = setInterval(fetchCounts, 30000);

    return () => {
        window.removeEventListener('alert-update', handleAlertUpdate);
        clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const checkAndClearBadge = async () => {
        if (pathname === '/admin/caregivers' && counts.caregivers > 0) {
            await markAsViewed('caregivers');
            setCounts(prev => ({ ...prev, caregivers: 0 }));
        }
        
        if (pathname === '/admin/dependents' && counts.dependents > 0) {
            await markAsViewed('dependents');
            setCounts(prev => ({ ...prev, dependents: 0 }));
        }
    };
    
    checkAndClearBadge();
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
      badge: counts.caregivers,
    },
    {
      title: 'ผู้ที่มีภาวะพึ่งพิง',
      href: '/admin/dependents',
      icon: UserCog,
      badge: counts.dependents,
    },
    {
      title: 'การแจ้งเตือน',
      href: '/admin/alerts',
      icon: AlertTriangle,
      badge: counts.alerts,
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
      badge: counts.transactions,
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
          
          {/* ✅ ส่วน Header แบบใหม่: Logo เต็มๆ ไม่มีกรอบ ไม่มี Text */}
          <div className="h-32 flex items-center justify-center p-6 border-b border-gray-800">
            <div className="relative w-full h-full">
                <Image 
                    src="/images/afe-logo.png"
                    alt="AFE PLUS Logo"
                    fill
                    priority
                />
            </div>
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
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  )}
                >
                  <div className="flex items-center gap-3">
                      <Icon className={cn("w-5 h-5", isActive ? "text-white" : "text-gray-400 group-hover:text-white")} />
                      <span className="font-medium text-sm">{item.title}</span>
                  </div>
                  
                  {item.badge !== undefined && item.badge > 0 && (
                      <span className="flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white animate-pulse shadow-sm shadow-red-900">
                          {item.badge > 99 ? '99+' : item.badge}
                      </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-gray-800 bg-gray-900/50">
            <p className="text-[10px] text-gray-500 text-center font-mono">
              Version 2.0.0 (Beta)
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}