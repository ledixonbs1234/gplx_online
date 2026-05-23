'use client';

import { Button } from '@/components/ui/button';
import { DayReport, Candidate } from '@/types/candidate';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

interface ExportButtonProps {
  candidates: Candidate[];
  report: DayReport;
}

export function ExportButton({ candidates, report }: ExportButtonProps) {
  const handleExport = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Báo cáo tổng hợp
    const summaryData = [
      ['BÁO CÁO NGÀY THI', report.date],
      [],
      ['THÔNG TIN TỔNG QUÁT', '', 'SỐ LƯỢNG'],
      ['Tổng số học viên', '', report.total_candidates],
      ['Không có hồ sơ', '', report.no_profile_count],
      ['Rớt', '', report.fail_count],
      ['Thi đậu', '', report.pass_count],
      [],
      ['NHÓM ĐÃ NỘP TIỀN', '', 'SỐ LƯỢNG'],
      ['Tổng số', '', report.with_app_and_fee.total],
      ['GPLX về + up postal', '', report.with_app_and_fee.returned_with_postal],
      ['GPLX chưa về', '', report.with_app_and_fee.pending],
      [],
      ['NHÓM CHƯA NỘP TIỀN', '', 'SỐ LƯỢNG'],
      ['Tổng số', '', report.without_fee.total],
      ['GPLX về', '', report.without_fee.returned],
      ['GPLX chưa về', '', report.without_fee.pending],
      [],
      ['TỔNG KẾT', '', ''],
      ['Tổng chưa có GPLX', '', report.with_app_and_fee.pending + report.without_fee.pending],
    ];

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    
    // Set độ rộng cột
    summarySheet['!cols'] = [
      { wch: 35 },
      { wch: 5 },
      { wch: 15 },
    ];
    
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Báo cáo tổng hợp');

    // Sheet 2: Danh sách chi tiết
    const detailData = [
      ['ID', 'Họ tên', 'Ngày thi', 'Có hồ sơ', 'Kết quả', 'Đã Nộp Tiền', 'GPLX', 'Up postal'],
      ...candidates.map((c) => [
        c.id,
        c.name,
        c.exam_date,
        c.has_profile ? 'Có' : 'Không',
        c.exam_status,
        c.has_app_and_fee ? 'Đã Nộp' : 'Chưa Nộp',
        c.gplx_status,
        c.has_postal_up ? 'Có' : 'Không',
      ]),
    ];

    const detailSheet = XLSX.utils.aoa_to_sheet(detailData);
    detailSheet['!cols'] = [
      { wch: 10 },
      { wch: 25 },
      { wch: 15 },
      { wch: 12 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 12 },
    ];
    
    XLSX.utils.book_append_sheet(wb, detailSheet, 'Danh sách chi tiết');

    // Sheet 3: Danh sách cần lọc (chưa có GPLX)
    const pendingCandidates = candidates.filter(
      (c) => c.exam_status === 'Pass' && c.gplx_status === 'Pending'
    );

    const pendingData = [
      ['ID', 'Họ tên', 'Ngày thi', 'Nhóm', 'Ghi chú'],
      ...pendingCandidates.map((c) => [
        c.id,
        c.name,
        c.exam_date,
        c.has_app_and_fee ? 'Đã Nộp Tiền' : 'Chưa Nộp Tiền',
        'Cần theo dõi GPLX',
      ]),
    ];

    const pendingSheet = XLSX.utils.aoa_to_sheet(pendingData);
    pendingSheet['!cols'] = [
      { wch: 10 },
      { wch: 25 },
      { wch: 15 },
      { wch: 20 },
      { wch: 25 },
    ];
    
    XLSX.utils.book_append_sheet(wb, pendingSheet, 'Cần lọc - Chưa có GPLX');

    // Xuất file
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    
    saveAs(data, `Bao-cao-${report.date}.xlsx`);
  };

  return (
    <Button onClick={handleExport} variant="default" size="sm">
      <Download className="h-4 w-4 mr-2" />
      Xuất Excel báo cáo
    </Button>
  );
}