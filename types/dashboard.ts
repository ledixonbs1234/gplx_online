import { DayReport } from './candidate';

export interface DashboardStats {
  totalExamDays: number;
  totalCandidates: number;
  totalPassed: number;
  totalFailed: number;
  totalPendingGPLX: number;
  totalReturnedGPLX: number;
  averagePassRate: number;
  averageCandidatesPerDay: number;
}

export interface DailyTrend {
  date: string;
  total: number;
  passed: number;
  failed: number;
  pendingGPLX: number;
  passRate: number;
}

export function calculateDashboardStats(reports: Map<string, DayReport>): DashboardStats {
  const allReports = Array.from(reports.values());
  
  const totals = allReports.reduce(
    (acc, report) => ({
      totalCandidates: acc.totalCandidates + report.total_candidates,
      totalPassed: acc.totalPassed + report.pass_count,
      totalFailed: acc.totalFailed + report.fail_count + report.no_profile_count,
      totalPendingGPLX: acc.totalPendingGPLX + report.with_app_and_fee.pending + report.without_fee.pending,
      totalReturnedGPLX: acc.totalReturnedGPLX + report.with_app_and_fee.returned_with_postal + report.without_fee.returned,
    }),
    {
      totalCandidates: 0,
      totalPassed: 0,
      totalFailed: 0,
      totalPendingGPLX: 0,
      totalReturnedGPLX: 0,
    }
  );

  return {
    totalExamDays: allReports.length,
    ...totals,
    averagePassRate: totals.totalCandidates > 0 
      ? (totals.totalPassed / totals.totalCandidates) * 100 
      : 0,
    averageCandidatesPerDay: allReports.length > 0
      ? totals.totalCandidates / allReports.length
      : 0,
  };
}

export function calculateDailyTrends(reports: Map<string, DayReport>): DailyTrend[] {
  return Array.from(reports.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, report]) => ({
      date,
      total: report.total_candidates,
      passed: report.pass_count,
      failed: report.fail_count + report.no_profile_count,
      pendingGPLX: report.with_app_and_fee.pending + report.without_fee.pending,
      passRate: report.total_candidates > 0
        ? (report.pass_count / report.total_candidates) * 100
        : 0,
    }));
}