'use client';

import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bell, Search, Menu, Command } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onMenuClick?: () => void;
}

export function Header({ title, subtitle, onMenuClick }: HeaderProps) {
  const [searchFocused, setSearchFocused] = useState(false);

  return (
    <header className="sticky top-0 z-30 glass-strong border-b">
      <div className="flex items-center justify-between h-16 px-4 lg:px-6">
        {/* Left: Menu + Title */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onMenuClick}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div>
            <motion.h1
              key={title}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xl font-bold"
            >
              {title}
            </motion.h1>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Center: Search */}
        <div className="hidden md:flex flex-1 max-w-md mx-8">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm học viên, ngày thi..."
              className="pl-10 pr-20 glass border-transparent focus:border-primary transition-all"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
            {!searchFocused && (
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex h-5 items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                <Command className="h-3 w-3" />K
              </kbd>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          
          <Button
            variant="ghost"
            size="icon"
            className="relative w-9 h-9 rounded-full glass hover:scale-105 transition-transform"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full ring-2 ring-card" />
          </Button>

          <div className="hidden sm:flex items-center gap-2 pl-2 ml-2 border-l">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-sm font-bold">
              A
            </div>
            <div className="hidden lg:block">
              <p className="text-sm font-medium leading-tight">Admin</p>
              <p className="text-xs text-muted-foreground leading-tight">Quản trị viên</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}