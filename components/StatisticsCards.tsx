'use client';

import { Card, CardContent } from '@/components/ui/card';
import { DashboardStats } from '@/types/dashboard';
import { 
  Users, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  TrendingUp, 
  Calendar,
  Award
} from 'lucide-react';

interface StatisticsCardsProps {
  stats: DashboardStats;
}

export function StatisticsCards({ stats }: StatisticsCardsProps) {
  const cards = [
    {
      title: 'Tổng ngày thi',
      value: stats.totalExamDays,
      icon: Calendar,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700',
    },
    {
      title: 'Tổng học viên',
      value: stats.totalCandidates.toLocaleString(),
      icon: Users,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-700',
    },
    {
      title: 'Thi đậu',
      value: stats.totalPassed.toLocaleString(),
      icon: CheckCircle2,
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-50',
      textColor: 'text-green-700',
    },
    {
      title: 'Rớt / Không hồ sơ',
      value: stats.totalFailed.toLocaleString(),
      icon: XCircle,
      color: 'from-red-500 to-red-600',
      bgColor: 'bg-red-50',
      textColor: 'text-red-700',
    },
    {
      title: 'Chờ GPLX',
      value: stats.totalPendingGPLX.toLocaleString(),
      icon: Clock,
      color: 'from-yellow-500 to-orange-500',
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-700',
    },
    {
      title: 'Đã nhận GPLX',
      value: stats.totalReturnedGPLX.toLocaleString(),
      icon: Award,
      color: 'from-indigo-500 to-indigo-600',
      bgColor: 'bg-indigo-50',
      textColor: 'text-indigo-700',
    },
    {
      title: 'Tỷ lệ đậu TB',
      value: `${stats.averagePassRate.toFixed(1)}%`,
      icon: TrendingUp,
      color: 'from-pink-500 to-rose-600',
      bgColor: 'bg-pink-50',
      textColor: 'text-pink-700',
    },
    {
      title: 'HV/ngày TB',
      value: stats.averageCandidatesPerDay.toFixed(0),
      icon: Users,
      color: 'from-teal-500 to-cyan-600',
      bgColor: 'bg-teal-50',
      textColor: 'text-teal-700',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title} className="overflow-hidden hover:shadow-lg transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-lg ${card.bgColor}`}>
                  <Icon className={`h-5 w-5 ${card.textColor}`} />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">{card.title}</p>
                <p className={`text-2xl font-bold bg-gradient-to-r ${card.color} bg-clip-text text-transparent`}>
                  {card.value}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}