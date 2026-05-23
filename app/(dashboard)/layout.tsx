'use client';

import { Sidebar } from '@/components/layout/Sidebar';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [windowWidth, setWindowWidth] = useState(0);

  useEffect(() => {
    setIsMounted(true);
    setWindowWidth(window.innerWidth);
    
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getMarginLeft = () => {
    if (!isMounted) return '0px';
    return windowWidth >= 1024 ? (collapsed ? '80px' : '280px') : '0px';
  };

  return (
    <div className="min-h-screen mesh-bg">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      
      <motion.main
        initial={{ marginLeft: '0px' }}
        animate={{
          marginLeft: getMarginLeft(),
        }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="min-h-screen pb-20 lg:pb-0"
      >
        {children}
      </motion.main>
    </div>
  );
}
