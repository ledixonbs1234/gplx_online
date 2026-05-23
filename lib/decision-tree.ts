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
      returned_with_postal: 0,
      pending: 0,
    },
    without_fee: {
      total: 0,
      returned: 0,
      pending: 0,
    },
  };

  candidates.forEach((candidate) => {
    // Nhánh 1: Không có hồ sơ
    if (!candidate.has_profile) {
      report.no_profile_count++;
      return;
    }

    // Kiểm tra kết quả thi
    if (candidate.exam_status === 'Fail') {
      report.fail_count++;
      return;
    }

    if (candidate.exam_status === 'Pass') {
      report.pass_count++;

      // Nhánh 2: Có hồ sơ + Thi đậu
      if (candidate.has_app_and_fee) {
        // Nhánh 2.1: Có Đã Nộp Tiền
        report.with_app_and_fee.total++;
        
        if (candidate.gplx_status === 'Returned' && candidate.has_postal_up) {
          report.with_app_and_fee.returned_with_postal++;
        } else if (candidate.gplx_status === 'Pending') {
          report.with_app_and_fee.pending++;
        }
      } else {
        // Nhánh 2.2: Chưa nộp tiền
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
      • GPLX về + up postal: ${report.with_app_and_fee.returned_with_postal}
      • GPLX chưa về: ${report.with_app_and_fee.pending}

   💸 CHƯA NỘP TIỀN: ${report.without_fee.total} người
      • GPLX về: ${report.without_fee.returned}
      • GPLX chưa về: ${report.without_fee.pending}

📌 TỔNG CHƯA CÓ GPLX: ${report.with_app_and_fee.pending + report.without_fee.pending} người
  `;
}