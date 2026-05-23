import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/providers/ThemeProvider';

const inter = Inter({ 
  subsets: ['latin', 'vietnamese'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'GPLX Manager - Hệ thống quản lý học viên',
  description: 'Ứng dụng quản lý học viên thi giấy phép lái xe hiện đại',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}