import type { Metadata } from 'next';
import { Sarabun } from 'next/font/google';
import { Toaster } from 'sonner';
import { GlobalModal } from '@/components/ui/global-modal';
import { ThemeProvider } from '@/components/theme-provider';
import '../styles/globals.css';

const sarabun = Sarabun({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '700'],
  variable: '--font-sarabun',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'AFE Plus',
  description: 'ระบบติดตามสุขภาพผู้ที่มีภาวะพึ่งพิงผ่าน Smart Watch',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" suppressHydrationWarning={true}>
      <body className={`${sarabun.variable} font-sans antialiased`}>
        <ThemeProvider>
          {children}
          <Toaster position="top-right" richColors closeButton />
          <GlobalModal />
        </ThemeProvider>
      </body>
    </html>
  );
}