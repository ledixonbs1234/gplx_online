// plx_online/app/(dashboard)/candidates/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, Users, FileSpreadsheet, Search, ExternalLink, Upload, CheckCircle2, AlertCircle, Download } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface Candidate {
  sbd: string;
  name: string;
  date_of_birth?: string;
  phone?: string;
  receive_location?: string;
  tracking_number?: string;
  exam_date: string;
  has_profile: boolean;
  exam_status: 'Pass' | 'Fail' | 'Not_Tested';
  has_app_and_fee: boolean;
  gplx_status: 'Returned' | 'Pending';
  has_postal_up?: boolean;
}

interface ExcelRow {
  sbd: string;
  fullName: string;
  dateOfBirth?: string;
  code?: string;
}

const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1LhWQJVepItW3Ag-vDGsZgmH4rX_TicLtVwD-y696bgk/edit?usp=sharing';

/**
 * Tách chuỗi người nhận ở cột E thành SBD, Họ Tên, Ngày Sinh
 */
function parseRecipient(text: string) {
  const cleaned = text.trim();
  if (!cleaned) return { sbd: '', name: '', dob: '' };

  const parts = cleaned.split(/\s+/);
  let sbd = '';
  let dob = '';
  let nameParts = [...parts];

  // Kiểm tra nếu phần đầu tiên là chữ số (Số báo danh)
  if (/^\d+$/.test(parts[0])) {
    sbd = parts[0];
    nameParts.shift();
  }

  // Kiểm tra nếu phần cuối cùng là ngày sinh (định dạng d/m/y, d-m-y hoặc serial 5 chữ số của Excel)
  if (nameParts.length > 0) {
    const lastToken = nameParts[nameParts.length - 1];
    if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(lastToken) || /^\d{5}$/.test(lastToken)) {
      dob = lastToken;
      nameParts.pop();
    }
  }

  const name = nameParts.join(' ').trim();
  return { sbd, name, dob };
}

export default function CandidatesPage() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sheetsList, setSheetsList] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Trạng thái cập nhật mã hiệu
  const [isUpdatingCode, setIsUpdatingCode] = useState(false);
  const [updateResult, setUpdateResult] = useState<{ success: boolean; message: string; updatedCount?: number } | null>(null);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [unmatched, setUnmatched] = useState<any[]>([]);
  const [isResolvingConflict, setIsResolvingConflict] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExportingPending, setIsExportingPending] = useState(false);

  const parseSheetDate = (sheetName: string): Date => {
    const parts = sheetName.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      } else {
        return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      }
    }
    return new Date(sheetName);
  };

  useEffect(() => {
    const loadSheets = async () => {
      try {
        const response = await fetch('/api/sheets/sync?type=list');
        const result = await response.json();
        if (result.success) {
          setSheetsList(result.sheets || []);
        }
      } catch (error) {
        console.error('Error loading sheets:', error);
      }
    };
    loadSheets();
  }, []);

  const loadCandidates = async () => {
    if (!selectedDate) return;
    
    setIsLoading(true);
    try {
      const dateStr = format(selectedDate, 'dd-MM-yyyy');
      const response = await fetch(`/api/sheets/data?date=${dateStr}`);
      const result = await response.json();
      if (result.success) {
        setCandidates(result.candidates || []);
      } else {
        setCandidates([]);
      }
    } catch (error) {
      console.error('Error loading candidates:', error);
      setCandidates([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCandidates();
  }, [selectedDate]);

  const filteredCandidates = candidates.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.sbd.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: filteredCandidates.length,
    passed: filteredCandidates.filter(c => c.exam_status === 'Pass').length,
    failed: filteredCandidates.filter(c => c.exam_status === 'Fail').length,
    notTested: filteredCandidates.filter(c => c.exam_status === 'Not_Tested').length,
    hasProfile: filteredCandidates.filter(c => c.has_profile).length,
    returnedGPLX: filteredCandidates.filter(c => c.gplx_status === 'Returned').length,
  };

  const handleUpdateCode = async (file: File) => {
    setIsUpdatingCode(true);
    setUpdateResult(null);
    setConflicts([]);
    setUnmatched([]);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      const excelData: ExcelRow[] = [];
      // Đọc từ Hàng 3 trở đi (index 2)
      for (let i = 2; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length === 0) continue;
        
        // Cột E (index 4) là người nhận
        const recipientVal = row[4] ? String(row[4]).trim() : '';
        if (!recipientVal) continue;

        // Cột M (index 12) là số hiệu BG / Mã hiệu
        const code = row[12] ? String(row[12]).trim() : '';
        
        const parsed = parseRecipient(recipientVal);
        if (parsed.name || parsed.sbd) {
          excelData.push({
            sbd: parsed.sbd,
            fullName: parsed.name,
            dateOfBirth: parsed.dob,
            code,
          });
        }
      }

      if (excelData.length === 0) {
        setUpdateResult({ success: false, message: 'Không tìm thấy dữ liệu khả dụng từ hàng 3 trở đi trong file Excel' });
        setIsUpdatingCode(false);
        return;
      }

      const response = await fetch('/api/sheets/update-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ excelData }),
      });

      const result = await response.json();
      
      if (result.success) {
        setUpdateResult({
          success: true,
          message: `Xử lý hoàn tất! Đã cập nhật tự động thành công cho ${result.autoUpdatedCount} học viên khớp duy nhất.`,
          updatedCount: result.autoUpdatedCount,
        });
        
        setConflicts(result.conflicts || []);
        setUnmatched(result.unmatched || []);
        
        await loadCandidates();
      } else {
        setUpdateResult({ success: false, message: result.error || 'Xảy ra lỗi trong lúc phân tích dữ liệu bưu điện' });
      }
    } catch (error: any) {
      console.error('Lỗi tải dữ liệu Excel:', error);
      setUpdateResult({ success: false, message: error.message || 'Lỗi đối chiếu hệ thống' });
    } finally {
      setIsUpdatingCode(false);
    }
  };

  const handleResolveConflict = async (sheetName: string, sbd: string, code: string, conflictIndex: number) => {
    const resolveId = `${conflictIndex}-${sheetName}`;
    setIsResolvingConflict(resolveId);
    try {
      const response = await fetch('/api/sheets/update-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resolve_conflict',
          sheetName,
          sbd,
          code,
        }),
      });
      const result = await response.json();
      if (result.success) {
        alert(result.message);
        // Loại bỏ dòng đã chọn thành công ra khỏi màn hình
        setConflicts(prev => prev.filter((_, idx) => idx !== conflictIndex));
        await loadCandidates();
      } else {
        alert(`Lỗi: ${result.error}`);
      }
    } catch (error) {
      console.error(error);
      alert('Không thể thực hiện lưu mã hiệu bưu điện');
    } finally {
      setIsResolvingConflict(null);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleUpdateCode(file);
    }
  };

  const handleExportPendingGPLX = async () => {
    if (!selectedDate) return;

    setIsExportingPending(true);
    try {
      const pendingCandidates = candidates.filter(c => c.gplx_status === 'Pending');

      if (pendingCandidates.length === 0) {
        alert('Không có học viên nào ở trạng thái Chờ nhận GPLX cho ngày này.');
        setIsExportingPending(false);
        return;
      }

      const excelData = [
        ['SBD', 'Họ Tên', 'Ngày Sinh', 'Số Điện Thoại', 'Nơi Nhận', 'Mã Vận Đơn', 'Kết Quả', 'Đã Nộp Tiền', 'Trạng Thái GPLX'],
        ...pendingCandidates.map((c) => [
          c.sbd,
          c.name,
          c.date_of_birth || '',
          c.phone || '',
          c.receive_location || '',
          c.tracking_number || '',
          c.exam_status === 'Pass' ? 'Đậu' : c.exam_status === 'Fail' ? 'Rớt' : 'Chưa thi',
          c.has_app_and_fee ? 'Đã Nộp' : 'Chưa Nộp',
          'Chờ',
        ]),
      ];

      const XLSX = await import('xlsx');
      const worksheet = XLSX.utils.aoa_to_sheet(excelData);
      
      worksheet['!cols'] = [
        { wch: 12 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 18 }
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Chưa GPLX');

      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const data = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const fileName = `Danh Sách Chưa Có GPLX ngày ${format(selectedDate, 'dd-MM-yyyy')}.xlsx`;
      const { saveAs } = await import('file-saver');
      saveAs(data, fileName);
    } catch (error: any) {
      console.error('Error exporting:', error);
      alert('Có lỗi xảy ra: ' + (error.message || 'Lỗi không xác định'));
    } finally {
      setIsExportingPending(false);
    }
  };

  return (
    <>
      <Header
        title="Quản lý Học viên"
        subtitle="Xem chi tiết học viên theo ngày thi từ Google Sheets"
      />

      <div className="p-4 lg:p-8 space-y-6">
        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                Chọn ngày thi hiển thị
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, 'PPP', { locale: vi }) : 'Chọn ngày'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      setSelectedDate(date);
                      setIsCalendarOpen(false);
                    }}
                    locale={vi}
                  />
                </PopoverContent>
              </Popover>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Search className="h-4 w-4" />
                Tìm kiếm học viên
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="Nhập tên hoặc mã HV..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-green-600" />
                Google Sheets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <a
                href={GOOGLE_SHEET_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 w-full px-4 py-2 rounded-md bg-green-600 text-white font-medium hover:bg-green-700 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                Mở Google Sheets
              </a>
            </CardContent>
          </Card>
        </div>

        {/* Nút Upload Cập Nhật Mã Hiệu bưu điện */}
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-blue-700">
              <Upload className="h-4 w-4" />
              Cập nhật Mã Hiệu bưu điện từ Excel (Đối chiếu toàn bộ hệ thống)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Dữ liệu Excel hợp lệ: Bắt đầu từ **Hàng 3**, cột **E (Tên người nhận)** chứa thông tin học viên (Hỗ trợ tự động bóc tách SBD, Tên, Ngày Sinh), cột **M (Số hiệu BG)** là mã hiệu cần lấy.
            </p>
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
                disabled={isUpdatingCode}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUpdatingCode}
                className="flex-1"
              >
                {isUpdatingCode ? 'Đang phân tích và đối chiếu toàn bộ các sheets...' : 'Chọn file Excel bưu điện'}
              </Button>
            </div>
            
            {updateResult && (
              <div className={`p-3 rounded-md flex items-start gap-2 ${updateResult.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {updateResult.success ? <CheckCircle2 className="h-5 w-5 flex-shrink-0" /> : <AlertCircle className="h-5 w-5 flex-shrink-0" />}
                <p className="text-sm font-medium">{updateResult.message}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* BẢNG XỬ LÝ TRÙNG LẶP NHIỀU NGÀY THI (CONFLICTS) */}
        {conflicts.length > 0 && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader>
              <CardTitle className="text-amber-800 text-base font-bold flex items-center gap-2">
                ⚠️ Phát hiện trùng khớp thông tin trên nhiều ngày thi ({conflicts.length})
              </CardTitle>
              <p className="text-xs text-amber-700">
                Nhấn chọn chính xác ngày thi thích hợp dưới đây để ghi đè mã hiệu bưu điện tương ứng:
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-amber-100 text-amber-900 sticky top-0">
                    <tr className="text-left">
                      <th className="py-2 px-3">SBD</th>
                      <th className="py-2 px-3">Họ Tên</th>
                      <th className="py-2 px-3">Ngày Sinh</th>
                      <th className="py-2 px-3">Mã Hiệu (Cột M)</th>
                      <th className="py-2 px-3 text-center">Ghi nhận vào ngày thi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conflicts.map((conflict, idx) => (
                      <tr key={idx} className="border-b border-amber-200 hover:bg-amber-100/50">
                        <td className="py-2 px-3 font-mono">{conflict.excelRow.sbd || '-'}</td>
                        <td className="py-2 px-3 font-medium">{conflict.excelRow.fullName}</td>
                        <td className="py-2 px-3">{conflict.excelRow.dateOfBirth || '-'}</td>
                        <td className="py-2 px-3 font-mono">{conflict.excelRow.code || '-'}</td>
                        <td className="py-2 px-3 flex flex-wrap gap-1.5 justify-center">
                          {conflict.matches.map((match: any) => {
                            const resolveId = `${idx}-${match.sheetName}`;
                            return (
                              <Button
                                key={match.sheetName}
                                size="sm"
                                variant="outline"
                                className="bg-white border-amber-300 hover:bg-amber-200 hover:text-amber-900 font-semibold"
                                onClick={() => handleResolveConflict(match.sheetName, match.sbd, conflict.excelRow.code, idx)}
                                disabled={isResolvingConflict === resolveId}
                              >
                                {isResolvingConflict === resolveId ? '⏳...' : `📅 ${match.sheetName}`}
                              </Button>
                            );
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* BẢNG DANH SÁCH KHÔNG TÌM THẤY HỌC VIÊN (UNMATCHED) */}
        {unmatched.length > 0 && (
          <Card className="border-red-200 bg-red-50/50">
            <CardHeader>
              <CardTitle className="text-red-800 text-base font-bold flex items-center gap-2">
                ❌ Thí sinh tải lên không tìm thấy trong cơ sở dữ liệu ({unmatched.length})
              </CardTitle>
              <p className="text-xs text-red-700">
                Các thí sinh này không khớp bất kỳ thông tin nào trong toàn bộ lịch sử các ngày thi:
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-red-100 text-red-900 sticky top-0">
                    <tr className="text-left">
                      <th className="py-2 px-3">SBD</th>
                      <th className="py-2 px-3">Họ Tên</th>
                      <th className="py-2 px-3">Ngày Sinh</th>
                      <th className="py-2 px-3">Mã Hiệu (Cột M)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unmatched.map((row, idx) => (
                      <tr key={idx} className="border-b border-red-200 hover:bg-red-100/30">
                        <td className="py-2 px-3 font-mono">{row.sbd || '-'}</td>
                        <td className="py-2 px-3 font-medium">{row.fullName}</td>
                        <td className="py-2 px-3">{row.dateOfBirth || '-'}</td>
                        <td className="py-2 px-3 font-mono">{row.code || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ngày thi có dữ liệu */}
        {sheetsList.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">📋 Các ngày thi có dữ liệu ({sheetsList.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {sheetsList.map((sheet) => (
                  <Badge
                    key={sheet}
                    variant={selectedDate && (format(selectedDate, 'dd-MM-yyyy') === sheet || format(selectedDate, 'yyyy-MM-dd') === sheet) ? 'default' : 'secondary'}
                    className="cursor-pointer"
                    onClick={() => setSelectedDate(parseSheetDate(sheet))}
                  >
                    📅 {sheet}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Thống kê nhanh */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          <StatCard label="Tổng HV" value={stats.total} color="from-blue-500 to-cyan-500" />
          <StatCard label="Đậu" value={stats.passed} color="from-emerald-500 to-teal-500" />
          <StatCard label="Rớt" value={stats.failed} color="from-red-500 to-orange-500" />
          <StatCard label="Chưa thi" value={stats.notTested} color="from-amber-500 to-yellow-500" />
          <StatCard label="Có hồ sơ" value={stats.hasProfile} color="from-purple-500 to-pink-500" />
          <StatCard label="Đã nhận GPLX" value={stats.returnedGPLX} color="from-indigo-500 to-violet-500" />
        </div>

        {/* Danh sách học viên */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Danh sách học viên hiển thị
                {selectedDate && <Badge variant="secondary">{format(selectedDate, 'dd/MM/yyyy', { locale: vi })}</Badge>}
              </span>
              <div className="flex items-center gap-2">
                {isLoading && <span className="text-sm text-muted-foreground">Đang tải...</span>}
                {selectedDate && (
                  <Button onClick={handleExportPendingGPLX} disabled={isExportingPending || filteredCandidates.length === 0} size="sm" variant="outline">
                    {isExportingPending ? 'Đang xuất...' : 'Xuất Excel GPLX Chờ'}
                  </Button>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredCandidates.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">{isLoading ? 'Đang tải dữ liệu...' : 'Không có học viên nào cho ngày này'}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-3 px-4 font-semibold">SBD</th>
                      <th className="py-3 px-4 font-semibold">Họ tên</th>
                      <th className="py-3 px-4 font-semibold">Ngày Sinh</th>
                      <th className="py-3 px-4 font-semibold">Số Điện Thoại</th>
                      <th className="py-3 px-4 font-semibold">Nơi Nhận</th>
                      <th className="py-3 px-4 font-semibold">Mã Vận Đơn</th>
                      <th className="text-center py-3 px-4 font-semibold">Hồ sơ</th>
                      <th className="text-center py-3 px-4 font-semibold">Kết quả</th>
                      <th className="text-center py-3 px-4 font-semibold">Đã Nộp Tiền</th>
                      <th className="text-center py-3 px-4 font-semibold">GPLX</th>
                      <th className="text-center py-3 px-4 font-semibold">Postal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCandidates.map((candidate) => (
                      <tr key={candidate.sbd} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4 font-mono text-sm">{candidate.sbd}</td>
                        <td className="py-3 px-4 font-medium">{candidate.name}</td>
                        <td className="py-3 px-4 text-sm">{candidate.date_of_birth || '-'}</td>
                        <td className="py-3 px-4 text-sm">{candidate.phone || '-'}</td>
                        <td className="py-3 px-4 text-sm">{candidate.receive_location || '-'}</td>
                        <td className="py-3 px-4 font-mono text-xs">{candidate.tracking_number || '-'}</td>
                        <td className="text-center py-3 px-4">
                          <Badge variant={candidate.has_profile ? 'default' : 'secondary'}>{candidate.has_profile ? '✓' : '✗'}</Badge>
                        </td>
                        <td className="text-center py-3 px-4">
                          <StatusBadge status={candidate.exam_status} />
                        </td>
                        <td className="text-center py-3 px-4">
                          <Badge variant={candidate.has_app_and_fee ? 'default' : 'secondary'}>{candidate.has_app_and_fee ? '✓' : '✗'}</Badge>
                        </td>
                        <td className="text-center py-3 px-4">
                          <Badge variant={candidate.gplx_status === 'Returned' ? 'default' : 'secondary'}>{candidate.gplx_status === 'Returned' ? 'Đã về' : 'Chờ'}</Badge>
                        </td>
                        <td className="text-center py-3 px-4">
                          <Badge variant={candidate.has_postal_up ? 'default' : 'secondary'}>{candidate.has_postal_up ? '✓' : '✗'}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-xl bg-gradient-to-br ${color} p-4 text-white shadow-lg`}>
      <p className="text-xs opacity-90">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: 'Pass' | 'Fail' | 'Not_Tested' }) {
  const config = {
    Pass: { color: 'bg-emerald-500', label: 'Đậu' },
    Fail: { color: 'bg-red-500', label: 'Rớt' },
    Not_Tested: { color: 'bg-gray-500', label: 'Chưa thi' },
  };
  return <Badge className={`${config[status].color} text-white`}>{config[status].label}</Badge>;
}