'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { ModernStatCard } from '@/components/dashboard/ModernStatCard';
import { SkeletonCard, SkeletonChart } from '@/components/ui/skeleton-card';
import { GoogleSheetsSync } from '@/components/GoogleSheetsSync';
import { FileUploader } from '@/components/FileUploader';
import { ReportSummary } from '@/components/ReportSummary';
import { DecisionTreeChart } from '@/components/DecisionTreeChart';
import { CandidateTable } from '@/components/CandidateTable';
import { parseExcelFile } from '@/lib/excel-parser';
import { analyzeDecisionTree } from '@/lib/decision-tree';
import {
  calculateDashboardStats,
  calculateDailyTrends,
} from '@/types/dashboard';
import { Candidate, DayReport } from '@/types/candidate';
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Award,
  TrendingUp,
  Calendar,
  FileSpreadsheet,
  Upload,
  Sparkles,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function DashboardPage() {
  const [reports, setReports] = useState<Map<string, DayReport>>(new Map());
  const [candidatesByDate, setCandidatesByDate] = useState<Map<string, Candidate[]>>(new Map());
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'overview' | 'detail'>('overview');

  const dashboardStats = reports.size > 0 ? calculateDashboardStats(reports) : null;
  const dailyTrends = reports.size > 0 ? calculateDailyTrends(reports) : [];
  const reportDates = Array.from(reports.keys()).sort();

  const processCandidatesData = (data: Record<string, Candidate[]>) => {
    const newReports = new Map<string, DayReport>();
    const newCandidates = new Map<string, Candidate[]>();
    Object.entries(data).forEach(([date, candidates]) => {
      if (candidates.length > 0) {
        newReports.set(date, analyzeDecisionTree(candidates));
        newCandidates.set(date, candidates);
      }
    });
    setReports(newReports);
    setCandidatesByDate(newCandidates);
    setSelectedDate(Array.from(newReports.keys()).sort()[0] || '');
  };

  const handleSheetsSync = (data: Record<string, any[]>) => {
    processCandidatesData(data as Record<string, Candidate[]>);
  };

  const handleFileUpload = async (file: File) => {
    setIsLoading(true);
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const parsedData = parseExcelFile(buffer);
      const objectData: Record<string, Candidate[]> = {};
      parsedData.forEach((candidates, date) => {
        objectData[date] = candidates;
      });
      processCandidatesData(objectData);
    } finally {
      setIsLoading(false);
    }
  };

  const statCards = dashboardStats
    ? [
        {
          title: 'Tổng ngày thi',
          value: dashboardStats.totalExamDays,
          icon: Calendar,
          gradient: 'bg-gradient-to-br from-blue-500 to-cyan-500',
          change: { value: 12, label: 'so với tháng trước' },
        },
        {
          title: 'Tổng học viên',
          value: dashboardStats.totalCandidates.toLocaleString(),
          icon: Users,
          gradient: 'bg-gradient-to-br from-purple-500 to-pink-500',
          change: { value: 8, label: 'tăng trưởng' },
        },
        {
          title: 'Thi đậu',
          value: dashboardStats.totalPassed.toLocaleString(),
          icon: CheckCircle2,
          gradient: 'bg-gradient-to-br from-emerald-500 to-teal-500',
          change: { value: 5, label: 'cải thiện' },
        },
        {
          title: 'Rớt / Không hồ sơ',
          value: dashboardStats.totalFailed.toLocaleString(),
          icon: XCircle,
          gradient: 'bg-gradient-to-br from-red-500 to-orange-500',
          change: { value: -3, label: 'giảm so với trước' },
        },
        {
          title: 'Chờ GPLX',
          value: dashboardStats.totalPendingGPLX.toLocaleString(),
          icon: Clock,
          gradient: 'bg-gradient-to-br from-amber-500 to-orange-500',
        },
        {
          title: 'Đã nhận GPLX',
          value: dashboardStats.totalReturnedGPLX.toLocaleString(),
          icon: Award,
          gradient: 'bg-gradient-to-br from-indigo-500 to-purple-500',
          change: { value: 15, label: 'tăng mạnh' },
        },
        {
          title: 'Tỷ lệ đậu TB',
          value: `${dashboardStats.averagePassRate.toFixed(1)}%`,
          icon: TrendingUp,
          gradient: 'bg-gradient-to-br from-pink-500 to-rose-500',
          change: { value: 2.5, label: 'ổn định' },
        },
        {
          title: 'HV/ngày TB',
          value: dashboardStats.averageCandidatesPerDay.toFixed(0),
          icon: Users,
          gradient: 'bg-gradient-to-br from-violet-500 to-fuchsia-500',
        },
      ]
    : [];

  return (
    <>
      <Header
        title="Dashboard Tổng hợp"
        subtitle="Thống kê và phân tích dữ liệu học viên thi GPLX"
      />

      <div className="p-4 lg:p-8 space-y-6">
        {/* Welcome Banner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative overflow-hidden rounded-3xl p-8 bg-gradient-to-br from-primary via-accent to-pink-500 text-white shadow-glow"
        >
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.1%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-20" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-5 w-5" />
              <span className="text-sm font-medium opacity-90">
                Chào mừng trở lại!
              </span>
            </div>
            <h2 className="text-3xl font-bold mb-2">
              Quản lý Học viên Thi GPLX
            </h2>
            <p className="opacity-90 max-w-2xl">
              Hệ thống tự động phân loại học viên theo sơ đồ cây quyết định.
              Đồng bộ dữ liệu từ Google Sheets hoặc upload file Excel để bắt đầu.
            </p>
          </div>
        </motion.div>

        {/* Data Source Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl glass p-6"
        >
          <Tabs defaultValue="sheets">
            <TabsList className="grid w-full max-w-md grid-cols-2 mb-4 glass">
              <TabsTrigger value="sheets" className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Google Sheets
              </TabsTrigger>
              <TabsTrigger value="excel" className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Upload Excel
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sheets">
              <GoogleSheetsSync onSyncComplete={handleSheetsSync} />
            </TabsContent>

            <TabsContent value="excel">
              <FileUploader onFileUploaded={handleFileUpload} />
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
            <SkeletonChart />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && reports.size === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-3xl glass p-16 text-center"
          >
            <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-glow">
              <Sparkles className="h-12 w-12 text-white" />
            </div>
            <h3 className="text-2xl font-bold mb-2">Bắt đầu hành trình</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Đồng bộ dữ liệu từ Google Sheets hoặc upload file Excel để xem
              dashboard phân tích chi tiết
            </p>
          </motion.div>
        )}

        {/* Dashboard Content */}
        {reports.size > 0 && dashboardStats && (
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-6"
          >
            {/* Stats Grid */}
            <motion.div variants={item}>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map((card, i) => (
                  <ModernStatCard key={card.title} {...card} index={i} />
                ))}
              </div>
            </motion.div>

            {/* View Mode Toggle */}
            <motion.div variants={item} className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('overview')}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  viewMode === 'overview'
                    ? 'bg-gradient-to-r from-primary to-accent text-white shadow-lg'
                    : 'glass hover:bg-muted'
                }`}
              >
                📊 Tổng quan
              </button>
              <button
                onClick={() => setViewMode('detail')}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  viewMode === 'detail'
                    ? 'bg-gradient-to-r from-primary to-accent text-white shadow-lg'
                    : 'glass hover:bg-muted'
                }`}
              >
                📋 Chi tiết từng ngày
              </button>
            </motion.div>

            {/* Overview Charts */}
            {viewMode === 'overview' && (
              <motion.div
                variants={item}
                className="grid grid-cols-1 lg:grid-cols-2 gap-6"
              >
                {/* Trend Chart */}
                <div className="lg:col-span-2 rounded-2xl glass p-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Xu hướng học viên qua các ngày
                  </h3>
                  <ResponsiveContainer width="100%" height={320}>
                    <AreaChart data={dailyTrends}>
                      <defs>
                        <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip
                        contentStyle={{
                          background: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '12px',
                        }}
                      />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="total"
                        stroke="#8b5cf6"
                        fill="url(#g1)"
                        name="Tổng HV"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="passed"
                        stroke="#10b981"
                        fill="url(#g2)"
                        name="Đậu"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Bar Chart */}
                <div className="rounded-2xl glass p-6">
                  <h3 className="text-lg font-bold mb-4">Kết quả thi</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={dailyTrends}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip
                        contentStyle={{
                          background: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '12px',
                        }}
                      />
                      <Bar dataKey="passed" fill="#10b981" radius={[8, 8, 0, 0]} name="Đậu" />
                      <Bar dataKey="failed" fill="#ef4444" radius={[8, 8, 0, 0]} name="Rớt" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Line Chart */}
                <div className="rounded-2xl glass p-6">
                  <h3 className="text-lg font-bold mb-4">Tỷ lệ đậu (%)</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={dailyTrends}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                      <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip
                        contentStyle={{
                          background: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '12px',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="passRate"
                        stroke="#ec4899"
                        strokeWidth={3}
                        name="Tỷ lệ đậu"
                        dot={{ r: 6, fill: '#ec4899' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            )}

            {/* Detail View */}
            {viewMode === 'detail' && (
              <motion.div variants={item}>
                <Tabs value={selectedDate} onValueChange={setSelectedDate}>
                  <TabsList className="flex flex-wrap gap-2 mb-4 glass p-1 h-auto">
                    {reportDates.map((date) => (
                      <TabsTrigger key={date} value={date} className="px-4">
                        📅 {date}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  <AnimatePresence mode="wait">
                    {reportDates.map((date) => (
                      <TabsContent key={date} value={date}>
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="space-y-4"
                        >
                          <ReportSummary report={reports.get(date)!} />
                          <DecisionTreeChart report={reports.get(date)!} />
                          <CandidateTable candidates={candidatesByDate.get(date)!} />
                        </motion.div>
                      </TabsContent>
                    ))}
                  </AnimatePresence>
                </Tabs>
              </motion.div>
            )}
          </motion.div>
        )}
      </div>
    </>
  );
}