'use client';

import { useAuthStore, useAlertStore, useModalStore } from '@/store/store';
import { Bell, Menu, User, LogOut, ChevronDown, Sun, Moon, Monitor } from 'lucide-react';
import { toast } from 'sonner';
import { ProfileDialog } from '@/components/features/admins/profile-dialog';
import { useState, useEffect } from 'react';
import { getAdminProfile } from '@/actions/admin.actions';
import { useTheme } from '@/components/theme-provider';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, logout, setUser } = useAuthStore();
  const { unreadCount } = useAlertStore();
  const { openModal } = useModalStore();
  const { theme, setTheme } = useTheme();

  const [profile, setProfile] = useState<{ firstName: string; lastName: string; username: string; image: string | null } | null>(null);

  // Notifications state
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    if (user?.id) {
      getAdminProfile(user.id).then(res => {
        if (res) {
          setProfile({
            firstName: res.firstName,
            lastName: res.lastName,
            username: res.username,
            image: res.image
          });
        }
      });
    }
  }, [user?.id]);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/admin/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error("Failed to fetch notifications");
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Poll every 30s
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleClear = async (id: string | number) => {
    try {
      await fetch('/api/admin/notifications', {
        method: 'DELETE',
        body: JSON.stringify({ id })
      });
      if (id === 'all') {
        setNotifications([]);
      } else {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }
    } catch (error) {
      toast.error("ไม่สามารถลบการแจ้งเตือนได้");
    }
  };

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
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between sticky top-0 z-40 rounded-bl-3xl rounded-br-3xl shadow-sm transition-colors duration-300">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-200"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      <div className="flex items-center gap-4">

        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Bell className="w-6 h-6 text-gray-600 dark:text-gray-200" />
            {notifications.length > 0 && (
              <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {notifications.length > 99 ? '99+' : notifications.length}
              </span>
            )}
          </button>

          {showNotifications && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowNotifications(false)}
              />
              <div className="absolute top-12 right-0 w-80 md:w-96 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between shrink-0 bg-gray-50/50 dark:bg-gray-900/50">
                  <h3 className="font-semibold text-gray-800 dark:text-gray-100">Notifications</h3>
                  {notifications.length > 0 && (
                    <button
                      onClick={() => handleClear('all')}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                <div className="overflow-y-auto flex-1 p-2 space-y-1 custom-scrollbar">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400 flex flex-col items-center gap-2">
                      <Bell className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                      <p className="text-sm">No new notifications</p>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} className="relative group bg-white dark:bg-gray-800 hover:bg-blue-50/50 dark:hover:bg-gray-700/50 p-3 rounded-xl transition-all border border-transparent hover:border-blue-100 dark:hover:border-gray-600 cursor-default">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleClear(n.id);
                          }}
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-all"
                        >
                          <LogOut className="w-3 h-3 rotate-180" />
                        </button>
                        <div className="flex gap-3">
                          <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${n.type === 'HELP' ? 'bg-red-500' :
                            n.type === 'BORROW' ? 'bg-orange-500' :
                              n.type === 'REGISTER' ? 'bg-green-500' : 'bg-blue-500'
                            }`} />
                          <div>
                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 pr-4">{n.title}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{n.message}</p>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2">
                              {new Date(n.createdAt).toLocaleString('en-US')}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="relative outline-none transition-transform active:scale-95"
          >
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-gray-700 shadow-sm overflow-hidden hover:ring-blue-100 dark:hover:ring-gray-600 transition-all">
              {profile?.image ? (
                <img src={profile.image} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-6 h-6 text-white" />
              )}
            </div>
          </button>

          {showProfileMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowProfileMenu(false)}
              />
              <div className="absolute top-14 right-0 w-64 bg-white dark:bg-[#0A0A0A] rounded-xl shadow-xl border border-gray-200 dark:border-gray-800 z-50 overflow-hidden py-2">

                <div className="px-4 pb-3 pt-2">
                  <p className="k text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {profile?.firstName || user?.firstName} {profile?.lastName || user?.lastName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5 font-normal">
                    {profile?.username || user?.username || 'admin'}
                  </p>
                </div>

                <div className="h-[1px] bg-gray-100 dark:bg-gray-800 w-full my-1" />

                <div className="py-1">
                  <a href="/admin/dashboard" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
                    Dashboard
                  </a>
                  <a href="/admin/settings" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
                    Account Settings
                  </a>
                </div>

                <div className="h-[1px] bg-gray-100 dark:bg-gray-800 w-full my-1" />

                <div className="px-4 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-300">Theme</span>
                    <div className="flex items-center p-1 bg-gray-100 dark:bg-gray-900 rounded-full border border-gray-200 dark:border-gray-800">
                      <button
                        onClick={() => setTheme('system')}
                        className={`p-1.5 rounded-full transition-all ${theme === 'system' ? 'bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        title="System"
                      >
                        <Monitor className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setTheme('light')}
                        className={`p-1.5 rounded-full transition-all ${theme === 'light' ? 'bg-white dark:bg-gray-800 shadow-sm text-yellow-500' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        title="Light"
                      >
                        <Sun className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setTheme('dark')}
                        className={`p-1.5 rounded-full transition-all ${theme === 'dark' ? 'bg-white dark:bg-gray-800 shadow-sm text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        title="Dark"
                      >
                        <Moon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="h-[1px] bg-gray-100 dark:bg-gray-800 w-full my-1" />

                <div className="py-1">
                  <button
                    onClick={handleLogoutClick}
                    className="w-full text-left flex items-center justify-between px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                  >
                    Log Out
                    <LogOut className="w-4 h-4 ml-auto opacity-50" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}