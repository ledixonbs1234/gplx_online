'use client';

import { Sidebar } from '@/components/layout/Sidebar';
import { useState } from 'react';
import { motion } from 'framer-motion';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen mesh-bg">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      
      <motion.main
        initial={false}
        animate={{
          marginLeft: typeof window !== 'undefined' && window.innerWidth >= 1024
            ? collapsed ? 80 : 280
            : 0,
        }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="min-h-screen pb-20 lg:pb-0"
      >
        {children}
      </motion.main>
    </div>
  );
}