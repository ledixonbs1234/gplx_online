'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Upload,
  FileSpreadsheet,
  BarChart3,
  Settings,
  Users,
  Calendar,
  ChevronLeft,
  GraduationCap,
  Edit,
  LogOut,
  QrCode,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const menuItems = [
  {
    title: 'Tổng quan',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      // { label: 'Thống kê', href: '/analytics', icon: BarChart3 },
    ],
  },
  {
    title: 'Quản lý',
    items: [
      // { label: 'Ngày thi', href: '/exam-days', icon: Calendar },
      { label: 'Học viên', href: '/candidates', icon: Users },
      { label: 'Quét mã hiệu', href: '/scanner', icon: QrCode },
      { label: 'Nhập liệu trực tiếp', href: '/update', icon: Edit }, // MENU MỚI TÍCH HỢP Ở ĐÂY
      // { label: 'Upload dữ liệu', href: '/upload', icon: Upload },
      // { label: 'Google Sheets', href: '/sheets', icon: FileSpreadsheet },
    ],
  },
  {
    title: 'Hệ thống',
    items: [
      { label: 'Cài đặt', href: '/settings', icon: Settings },
    ],
  },
];

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 80 : 280 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="hidden lg:flex flex-col fixed left-0 top-0 h-screen glass-strong border-r z-40"
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b">
          <Link href="/" className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0 shadow-glow">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="overflow-hidden whitespace-nowrap"
                >
                  <h1 className="font-bold text-lg bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    GPLX Manager
                  </h1>
                  <p className="text-xs text-muted-foreground">v2.0</p>
                </motion.div>
              )}
            </AnimatePresence>
          </Link>
        </div>

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6 no-scrollbar">
          {menuItems.map((group) => (
            <div key={group.title}>
              <AnimatePresence>
                {!collapsed && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2"
                  >
                    {group.title}
                  </motion.p>
                )}
              </AnimatePresence>
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          'group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all',
                          isActive
                            ? 'bg-gradient-to-r from-primary/10 to-accent/10 text-primary'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        )}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="activeIndicator"
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-primary to-accent rounded-r-full"
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                          />
                        )}
                        <Icon
                          className={cn(
                            'h-5 w-5 flex-shrink-0 transition-transform',
                            isActive ? 'scale-110' : 'group-hover:scale-110'
                          )}
                        />
                        <AnimatePresence>
                          {!collapsed && (
                            <motion.span
                              initial={{ opacity: 0, width: 0 }}
                              animate={{ opacity: 1, width: 'auto' }}
                              exit={{ opacity: 0, width: 0 }}
                              className={cn(
                                'font-medium text-sm whitespace-nowrap overflow-hidden',
                                isActive && 'font-semibold'
                              )}
                            >
                              {item.label}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t p-3">
          <button
            onClick={onToggle}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl hover:bg-muted transition-colors"
          >
            <motion.div
              animate={{ rotate: collapsed ? 180 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <ChevronLeft className="h-4 w-4" />
            </motion.div>
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-sm font-medium"
                >
                  Thu gọn
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </motion.aside>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </>
  );
}

function MobileBottomNav() {
  const pathname = usePathname();
  const mobileItems = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Thống kê', href: '/analytics', icon: BarChart3 },
    { label: 'Upload', href: '/upload', icon: Upload },
    { label: 'Học viên', href: '/candidates', icon: Users },
    { label: 'Quét mã', href: '/scanner', icon: QrCode },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 glass-strong border-t z-40 px-2 py-2">
      <div className="flex justify-around items-center">
        {mobileItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all"
            >
              <div className="relative">
                <Icon
                  className={cn(
                    'h-5 w-5 transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )}
                />
                {isActive && (
                  <motion.div
                    layoutId="mobileIndicator"
                    className="absolute -inset-2 bg-primary/10 rounded-full -z-10"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
              </div>
              <span
                className={cn(
                  'text-xs font-medium',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}