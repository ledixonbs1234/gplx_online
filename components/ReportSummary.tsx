'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DayReport } from '@/types/candidate';

interface ReportSummaryProps {
  report: DayReport;
}

export function ReportSummary({ report }: ReportSummaryProps) {
  const totalPendingGPLX = report.with_app_and_fee.pending + report.without_fee.pending;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>📊 Báo cáo ngày: {report.date}</span>
            <Badge variant="secondary">Tổng: {report.total_candidates}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Hàng 1 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-red-600">{report.no_profile_count}</div>
                <p className="text-sm text-muted-foreground">❌ Không có hồ sơ</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-orange-600">{report.fail_count}</div>
                <p className="text-sm text-muted-foreground">🚫 Rớt</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-600">{report.pass_count}</div>
                <p className="text-sm text-muted-foreground">✅ Thi đậu</p>
              </CardContent>
            </Card>
          </div>

          {/* Hàng 2 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">💰 Đã Nộp Tiền</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span>Tổng số:</span>
                  <Badge variant="outline">{report.with_app_and_fee.total}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>GPLX về + up postal:</span>
                  <Badge className="bg-green-100 text-green-800">
                    {report.with_app_and_fee.returned_with_postal}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>GPLX chưa về:</span>
                  <Badge className="bg-yellow-100 text-yellow-800">
                    {report.with_app_and_fee.pending}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">💸 Chưa Nộp Tiền</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span>Tổng số:</span>
                  <Badge variant="outline">{report.without_fee.total}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>GPLX về:</span>
                  <Badge className="bg-green-100 text-green-800">
                    {report.without_fee.returned}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>GPLX chưa về:</span>
                  <Badge className="bg-yellow-100 text-yellow-800">
                    {report.without_fee.pending}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tổng kết */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold">📌 Tổng chưa có GPLX:</span>
                <Badge className="bg-blue-600 text-xl px-4 py-2">{totalPendingGPLX} người</Badge>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}