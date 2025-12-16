'use client';

import { useState } from 'react';
import { User, Users, Shield, Settings as SettingsIcon, LogOut } from 'lucide-react';
import { AdminTable } from '@/components/features/admins/admin-table';
import { MyAccountSection } from '@/components/features/settings/my-account-section';
import { AdminRegisterDialog } from '@/components/features/settings/admin-register-dialog'; // ปุ่มเพิ่ม Admin

interface SettingsViewProps {
  myAccount: any;
  allAdmins: any[];
}

export function SettingsView({ myAccount, allAdmins }: SettingsViewProps) {
  // State เก็บว่าเลือกเมนูไหนอยู่ (default: 'my-account')
  const [activeTab, setActiveTab] = useState<'my-account' | 'admins' | 'system'>('my-account');

  // รายการเมนู
  const menuItems = [
    { id: 'my-account', label: 'บัญชีของฉัน', icon: User, desc: 'แก้ไขข้อมูลส่วนตัว' },
    { id: 'admins', label: 'ผู้ดูแลระบบ', icon: Users, desc: 'จัดการสิทธิ์การเข้าถึง' },
    { id: 'system', label: 'การตั้งค่าระบบ', icon: SettingsIcon, desc: 'ตั้งค่าทั่วไปของระบบ' },
  ];

  return (
    <div className="flex h-[calc(100vh-140px)] bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      
      {/* 🟢 SIDEBAR (VS Code Style List) */}
      <div className="w-64 bg-slate-50 border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Settings</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto py-2">
            {menuItems.map((item) => (
                <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as any)}
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors relative
                        ${activeTab === item.id 
                            ? 'bg-white text-blue-600 font-bold shadow-sm' 
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                >
                    {/* Active Indicator Bar */}
                    {activeTab === item.id && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 rounded-r-full" />
                    )}
                    
                    <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-blue-600' : 'text-slate-400'}`} />
                    <div>
                        <div className="text-sm">{item.label}</div>
                        {/* <div className="text-[10px] font-normal text-slate-400">{item.desc}</div> */}
                    </div>
                </button>
            ))}
        </div>

        {/* Footer Sidebar */}
        <div className="p-4 text-xs text-slate-400 text-center border-t border-slate-200">
            v1.0.0
        </div>
      </div>

      {/* 🔵 CONTENT AREA */}
      <div className="flex-1 overflow-y-auto bg-white p-8">
        
        {/* Header ของแต่ละ Tab */}
        <div className="mb-6 pb-4 border-b border-slate-100 flex justify-between items-center">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">
                    {menuItems.find(m => m.id === activeTab)?.label}
                </h1>
                <p className="text-slate-500 text-sm mt-1">
                    {menuItems.find(m => m.id === activeTab)?.desc}
                </p>
            </div>
            
            {/* ปุ่มพิเศษเฉพาะหน้า Admins */}
            {activeTab === 'admins' && (
                <AdminRegisterDialog />
            )}
        </div>

        {/* Content Body */}
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            
            {/* 1. My Account Tab */}
            {activeTab === 'my-account' && (
                <div className="max-w-3xl mx-auto">
                    <MyAccountSection user={myAccount} />
                </div>
            )}

            {/* 2. Admin List Tab */}
            {activeTab === 'admins' && (
                <div>
                    <AdminTable data={allAdmins} />
                </div>
            )}

            {/* 3. System Settings Tab (Placeholder) */}
            {activeTab === 'system' && (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                    <Shield className="w-10 h-10 mb-3 opacity-20" />
                    <p>ส่วนการตั้งค่าระบบ (Coming Soon)</p>
                </div>
            )}

        </div>
      </div>
    </div>
  );
}