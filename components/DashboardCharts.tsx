'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DailyTrend } from '@/types/dashboard';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';

interface DashboardChartsProps {
  trends: DailyTrend[];
  totalPassed: number;
  totalFailed: number;
  totalPendingGPLX: number;
  totalReturnedGPLX: number;
}

export function DashboardCharts({ 
  trends, 
  totalPassed, 
  totalFailed,
  totalPendingGPLX,
  totalReturnedGPLX 
}: DashboardChartsProps) {
  // Custom tooltip cho biểu đồ
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-semibold mb-1">📅 {label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: <strong>{typeof entry.value === 'number' && entry.name.includes('%') 
                ? `${entry.value.toFixed(1)}%` 
                : entry.value}</strong>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const pieData = [
    { name: 'Đậu', value: totalPassed, color: '#10b981' },
    { name: 'Rớt', value: totalFailed, color: '#ef4444' },
  ];

  const gplxPieData = [
    { name: 'Đã nhận GPLX', value: totalReturnedGPLX, color: '#3b82f6' },
    { name: 'Chờ GPLX', value: totalPendingGPLX, color: '#f59e0b' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Biểu đồ xu hướng qua các ngày */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>📈 Xu hướng số lượng học viên qua các ngày thi</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={trends}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="colorPassed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#8b5cf6"
                fillOpacity={1}
                fill="url(#colorTotal)"
                name="Tổng số HV"
              />
              <Area
                type="monotone"
                dataKey="passed"
                stroke="#10b981"
                fillOpacity={1}
                fill="url(#colorPassed)"
                name="Đậu"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Biểu đồ cột: Đậu vs Rớt */}
      <Card>
        <CardHeader>
          <CardTitle>📊 Kết quả thi từng ngày</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="passed" fill="#10b981" name="Đậu" radius={[4, 4, 0, 0]} />
              <Bar dataKey="failed" fill="#ef4444" name="Rớt" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Biểu đồ đường: Tỷ lệ đậu */}
      <Card>
        <CardHeader>
          <CardTitle>📉 Tỷ lệ đậu (%) qua các ngày</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis domain={[0, 100]} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="passRate"
                stroke="#ec4899"
                strokeWidth={3}
                name="Tỷ lệ đậu (%)"
                dot={{ r: 6, fill: '#ec4899' }}
                activeDot={{ r: 8 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Biểu đồ tròn: Kết quả thi */}
      <Card>
        <CardHeader>
          <CardTitle>🎯 Phân bổ kết quả thi (Tổng)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent != null ? (percent * 100).toFixed(1) : 0)}%`}
                outerRadius={90}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Biểu đồ tròn: Trạng thái GPLX */}
      <Card>
        <CardHeader>
          <CardTitle>📬 Trạng thái GPLX (Tổng)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={gplxPieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent != null ? (percent * 100).toFixed(1) : 0)}%`}
                outerRadius={90}
                fill="#8884d8"
                dataKey="value"
              >
                {gplxPieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}