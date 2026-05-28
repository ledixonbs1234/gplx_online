// plx_online/lib/decision-tree.ts
import { Candidate, DayReport } from '@/types/candidate';

export function analyzeDecisionTree(candidates: Candidate[]): DayReport {
  const report: DayReport = {
    date: candidates[0]?.exam_date || '',
    total_candidates: candidates.length,
    no_profile_count: 0,
    fail_count: 0,
    pass_count: 0,
    with_app_and_fee: {
      total: 0,
      returned: 0,
      pending: 0,
    },
    without_fee: {
      total: 0,
      returned: 0,
      pending: 0,
    },
  };

  candidates.forEach((candidate) => {
    if (!candidate.has_profile) {
      report.no_profile_count++;
      return;
    }

    if (candidate.exam_status === 'Fail') {
      report.fail_count++;
      return;
    }

    if (candidate.exam_status === 'Pass') {
      report.pass_count++;

      if (candidate.has_app_and_fee) {
        report.with_app_and_fee.total++;
        if (candidate.gplx_status === 'Returned') {
          report.with_app_and_fee.returned++;
        } else if (candidate.gplx_status === 'Pending') {
          report.with_app_and_fee.pending++;
        }
      } else {
        report.without_fee.total++;
        if (candidate.gplx_status === 'Returned') {
          report.without_fee.returned++;
        } else if (candidate.gplx_status === 'Pending') {
          report.without_fee.pending++;
        }
      }
    }
  });

  return report;
}

export function generateReportSummary(report: DayReport): string {
  return `
📊 BÁO CÁO NGÀY THI: ${report.date}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Tổng số học viên: ${report.total_candidates} người

❌ KHÔNG CÓ HỒ SƠ: ${report.no_profile_count} người
   → Rớt: ${report.fail_count} người

✅ THI ĐẬU: ${report.pass_count} người

   💰 ĐÃ NỘP TIỀN: ${report.with_app_and_fee.total} người
      • GPLX đã về: ${report.with_app_and_fee.returned}
      • GPLX chưa về: ${report.with_app_and_fee.pending}

   💸 CHƯA NỘP TIỀN: ${report.without_fee.total} người
      • GPLX đã về: ${report.without_fee.returned}
      • GPLX chưa về: ${report.without_fee.pending}

📌 TỔNG CHƯA CÓ GPLX: ${report.with_app_and_fee.pending + report.without_fee.pending} người
  `;
}