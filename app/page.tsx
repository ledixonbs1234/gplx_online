'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Sparkles,
  FileSpreadsheet,
  BarChart3,
  Zap,
  Shield,
  ArrowRight,
  GraduationCap,
} from 'lucide-react';

export default function Home() {
  const features = [
    {
      icon: Zap,
      title: 'Phân loại tự động',
      description: 'Decision tree tự động phân loại học viên theo nhiều tiêu chí',
      gradient: 'from-yellow-500 to-orange-500',
    },
    {
      icon: FileSpreadsheet,
      title: 'Đồng bộ Google Sheets',
      description: 'Kết nối trực tiếp, cập nhật real-time từ Google Sheets',
      gradient: 'from-green-500 to-emerald-500',
    },
    {
      icon: BarChart3,
      title: 'Dashboard trực quan',
      description: 'Biểu đồ hiện đại, thống kê chi tiết từng ngày thi',
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      icon: Shield,
      title: 'Bảo mật & Ổn định',
      description: 'Xử lý dữ liệu an toàn, export báo cáo dễ dàng',
      gradient: 'from-purple-500 to-pink-500',
    },
  ];

  return (
    <div className="min-h-screen mesh-bg relative overflow-hidden">
      {/* Decorative blurs */}
      <div className="absolute top-20 -left-20 w-96 h-96 bg-primary/30 rounded-full blur-3xl" />
      <div className="absolute bottom-20 -right-20 w-96 h-96 bg-accent/30 rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 py-12 lg:py-20">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-16"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-glow">
              <GraduationCap className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                GPLX Manager
              </h1>
              <p className="text-xs text-muted-foreground">Quản lý thông minh</p>
            </div>
          </div>
        </motion.header>

        {/* Hero */}
        <div className="text-center max-w-4xl mx-auto mb-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-6"
          >
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Phiên bản 2.0 - Modern UI</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-5xl lg:text-7xl font-bold mb-6 leading-tight"
          >
            Quản lý học viên
            <br />
            <span className="bg-gradient-to-r from-primary via-accent to-pink-500 bg-clip-text text-transparent animate-gradient">
              Thi GPLX thông minh
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto"
          >
            Hệ thống tự động phân loại, theo dõi và báo cáo học viên thi giấy phép
            lái xe. Tiết kiệm thời gian, chính xác tuyệt đối.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link
              href="/dashboard"
              className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-primary to-accent text-white font-semibold shadow-glow hover:scale-105 transition-transform"
            >
              <LayoutDashboard className="h-5 w-5" />
              Mở Dashboard
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <button className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl glass font-semibold hover:scale-105 transition-transform">
              Xem hướng dẫn
            </button>
          </motion.div>
        </div>

        {/* Features Grid */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16"
        >
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                whileHover={{ y: -8 }}
                className="group relative rounded-2xl glass p-6 hover:shadow-elevated transition-shadow"
              >
                <div
                  className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform`}
                >
                  <Icon className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="rounded-3xl glass p-8 grid grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {[
            { value: '500+', label: 'Học viên/ngày' },
            { value: '99.9%', label: 'Độ chính xác' },
            { value: '10x', label: 'Nhanh hơn thủ công' },
            { value: '24/7', label: 'Hoạt động ổn định' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {stat.value}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}