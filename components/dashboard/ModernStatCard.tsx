'use client';

import { motion } from 'framer-motion';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModernStatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  gradient: string;
  change?: {
    value: number;
    label: string;
  };
  index: number;
}

export function ModernStatCard({
  title,
  value,
  icon: Icon,
  gradient,
  change,
  index,
}: ModernStatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="group relative overflow-hidden rounded-2xl glass p-5 hover:shadow-elevated transition-shadow"
    >
      {/* Background gradient blob */}
      <div
        className={cn(
          'absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-20 blur-2xl group-hover:opacity-40 transition-opacity',
          gradient
        )}
      />

      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div
            className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center shadow-lg',
              gradient
            )}
          >
            <Icon className="h-6 w-6 text-white" />
          </div>

          {change && (
            <div
              className={cn(
                'flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full',
                change.value >= 0
                  ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                  : 'bg-red-500/10 text-red-600 dark:text-red-400'
              )}
            >
              {change.value >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {Math.abs(change.value)}%
            </div>
          )}
        </div>

        <div>
          <p className="text-sm text-muted-foreground mb-1">{title}</p>
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          {change && (
            <p className="text-xs text-muted-foreground mt-1">{change.label}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}