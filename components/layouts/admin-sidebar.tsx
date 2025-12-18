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
import { getUnreadAlertCount } from '@/actions/alert.actions';

interface SidebarProps {
  isOpen: boolean;
}

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
  },
  {
    title: 'ผู้ที่มีภาวะพึ่งพิง',
    href: '/admin/dependents',
    icon: UserCog,
  },
  {
    title: 'การแจ้งเตือน',
    href: '/admin/alerts',
    icon: AlertTriangle,
    showBadge: true,
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

export function Sidebar({ isOpen }: SidebarProps) {
  const pathname = usePathname();
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    const fetchInitialCount = async () => {
        const res = await getUnreadAlertCount();
        setAlertCount(res.count);
    };
    fetchInitialCount();

    const handleAlertUpdate = (e: any) => {
        if (typeof e.detail === 'number') {
            setAlertCount(e.detail);
        }
    };

    window.addEventListener('alert-update', handleAlertUpdate);

    return () => window.removeEventListener('alert-update', handleAlertUpdate);
  }, []);

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
                  
                  {item.showBadge && alertCount > 0 && (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white animate-pulse shadow-sm shadow-red-900">
                          {alertCount > 99 ? '99+' : alertCount}
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