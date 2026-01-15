'use client';

import { useState } from 'react';
import { Header } from './admin-header';
import { Sidebar } from './admin-sidebar';
import { GlobalModal } from '../ui/global-modal';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-300">
      <GlobalModal />
      <Sidebar isOpen={isSidebarOpen} />

      <div className="flex-1 flex flex-col">
        <Header onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />

        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}