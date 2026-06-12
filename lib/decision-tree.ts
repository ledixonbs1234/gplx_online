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
      returned_with_postal: 0, // Khởi tạo giá trị ban đầu
    },
    without_fee: {
      total: 0,
      returned: 0,
      pending: 0,
      returned_with_postal: 0, // Khởi tạo giá trị ban đầu
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
          // Nếu có mã vận đơn, tính vào danh sách nhận qua bưu gửi
          if (candidate.tracking_number) {
            report.with_app_and_fee.returned_with_postal++;
          }
        } else if (candidate.gplx_status === 'Pending') {
          report.with_app_and_fee.pending++;
        }
      } else {
        report.without_fee.total++;
        if (candidate.gplx_status === 'Returned') {
          report.without_fee.returned++;
          // Nếu có mã vận đơn, tính vào danh sách nhận qua bưu gửi
          if (candidate.tracking_number) {
            report.without_fee.returned_with_postal++;
          }
        } else if (candidate.gplx_status === 'Pending') {
          report.without_fee.pending++;
        }
      }
    }
  });

  return report;
}