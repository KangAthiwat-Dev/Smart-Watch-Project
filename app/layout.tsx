import type { Metadata } from 'next';
import { Sarabun } from 'next/font/google'; // Import Sarabun
import { Toaster } from 'sonner';
import { GlobalModal } from '@/components/ui/global-modal';
import '../styles/globals.css';

const sarabun = Sarabun({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '700'], 
  variable: '--font-sarabun',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Smart Watch Monitoring System',
  description: 'ระบบติดตามสุขภาพผู้สูงอายุผ่าน Smart Watch',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" suppressHydrationWarning={true}>
      {/* ✅ เติม font-sans ตรงนี้ครับ */}
      <body className={`${sarabun.variable} font-sans antialiased`}>
        {children}
        <Toaster position="top-right" richColors closeButton />
        <GlobalModal />
      </body>
    </html>
  );
}