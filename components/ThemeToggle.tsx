'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Moon, Sun, Monitor } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="w-9 h-9" />;

  const themes = [
    { value: 'light', icon: Sun, label: 'Sáng' },
    { value: 'dark', icon: Moon, label: 'Tối' },
    { value: 'system', icon: Monitor, label: 'Hệ thống' },
  ];

  const currentTheme = themes.find(t => t.value === theme) || themes[0];
  const Icon = currentTheme.icon;

  return (
    <div className="relative group">
      <Button
        variant="ghost"
        size="icon"
        className="relative w-9 h-9 rounded-full glass hover:scale-105 transition-transform"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={theme}
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Icon className="h-4 w-4" />
          </motion.div>
        </AnimatePresence>
      </Button>
      
      {/* Dropdown */}
      <div className="absolute right-0 top-full mt-2 w-40 glass-strong rounded-xl shadow-elevated opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
        <div className="p-1">
          {themes.map((t) => {
            const TIcon = t.icon;
            return (
              <button
                key={t.value}
                onClick={() => setTheme(t.value)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  theme === t.value
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'hover:bg-muted'
                }`}
              >
                <TIcon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}