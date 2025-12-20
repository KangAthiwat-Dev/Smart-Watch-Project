'use client';

import { useAuthStore, useAlertStore, useModalStore } from '@/store/store';
import { Bell, Menu, User, LogOut, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { ProfileDialog } from '@/components/features/admins/profile-dialog';
import { useState, useEffect } from 'react';
import { getAdminProfile } from '@/actions/admin.actions';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, logout, setUser } = useAuthStore();
  const { unreadCount } = useAlertStore();
  const { openModal } = useModalStore();

  // State พิเศษสำหรับเก็บรูปภาพใน Header เพื่อให้เปลี่ยนทันทีที่อัปโหลด
  const [headerImage, setHeaderImage] = useState<string | null>(null);

  // โหลดรูปครั้งแรกตอนเข้าเว็บ (เพราะใน authStore อาจจะไม่มีรูปเก็บไว้)
  useEffect(() => {
    if (user?.id) {
        getAdminProfile(user.id).then(res => {
            if (res?.image) setHeaderImage(res.image);
        });
    }
  }, [user?.id]);

  const performLogout = async () => {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        logout();
        if (typeof window !== 'undefined') {
          window.sessionStorage.clear();
          window.localStorage.removeItem('auth-storage');
        }
        toast.success('ออกจากระบบสำเร็จ');
        window.location.href = '/admin/login';
      } catch (error) {
        logout();
        window.location.href = '/admin/login';
      }
  };

  const handleLogoutClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    openModal({
      type: 'confirm',
      title: 'ยืนยันการออกจากระบบ',
      content: 'คุณต้องการออกจากระบบใช่หรือไม่?',
      onConfirm: performLogout,
    });
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-40 rounded-bl-3xl rounded-br-3xl shadow-sm">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button className="relative p-2 hover:bg-gray-100 rounded-lg">
          <Bell className="w-6 h-6 text-gray-600" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* ✅ User Menu & Profile Edit */}
        <ProfileDialog 
            userId={user?.id || 0}
            onUpdateSuccess={(newData) => {
                // 1. อัปเดตชื่อใน Store
                if (user) {
                    setUser({ ...user, firstName: newData.firstName, lastName: newData.lastName });
                }
                // 2. ✅ อัปเดตรูปใน Header ทันที (ถ้ามีการส่งรูปกลับมา)
                if (newData.image) {
                    setHeaderImage(newData.image);
                }
            }}
            trigger={
                <div className="flex items-center gap-3 pl-4 border-l border-gray-200 cursor-pointer group hover:bg-gray-50 p-2 rounded-xl transition-all">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-medium text-gray-800 group-hover:text-blue-700 transition-colors">
                            {user?.firstName} {user?.lastName}
                        </p>
                        <p className="text-xs text-gray-500">
                            ผู้ดูแลระบบ
                        </p>
                    </div>
                    
                    <div className="relative">
                        {/* ✅ 3. เช็คว่ามีรูปไหม ถ้ามีให้โชว์รูป ถ้าไม่มีโชว์ไอคอนเดิม */}
                        <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center ring-2 ring-white shadow-sm group-hover:ring-blue-100 overflow-hidden">
                            {headerImage ? (
                                <img src={headerImage} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <User className="w-6 h-6 text-white" />
                            )}
                        </div>
                        
                        <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm border border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ChevronDown className="w-3 h-3 text-gray-500" />
                        </div>
                    </div>
                    
                    <button
                        onClick={handleLogoutClick}
                        className="p-2 ml-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors border border-transparent hover:border-red-100"
                        title="ออกจากระบบ"
                    >
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            }
        />
      </div>
    </header>
  );
}