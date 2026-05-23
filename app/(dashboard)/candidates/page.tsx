'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, Users, FileSpreadsheet, Search, Plus, ExternalLink, Upload, CheckCircle2, AlertCircle, Download } from 'lucide-react';
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

export default function CandidatesPage() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sheetsList, setSheetsList] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isUpdatingCode, setIsUpdatingCode] = useState(false);
  const [updateResult, setUpdateResult] = useState<{ success: boolean; message: string; updatedCount?: number; notFoundCount?: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExportingPending, setIsExportingPending] = useState(false);

  // Helper chuyển đổi định dạng chuỗi ngày (dd-MM-yyyy hoặc yyyy-MM-dd) sang Object Date
  const parseSheetDate = (sheetName: string): Date => {
    const parts = sheetName.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // yyyy-MM-dd
        return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      } else {
        // dd-MM-yyyy
        return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      }
    }
    return new Date(sheetName);
  };

  // Load danh sách sheets khi mount
  useEffect(() => {
    const loadSheets = async () => {
      try {
        const response = await fetch('/api/sheets/sync');
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

  // Load dữ liệu học viên theo ngày thi (sử dụng dd-MM-yyyy)
  useEffect(() => {
    const loadCandidates = async () => {
      if (!selectedDate) return;
      
      setIsLoading(true);
      try {
        const dateStr = format(selectedDate, 'dd-MM-yyyy'); // Sử dụng chuẩn dd-MM-yyyy
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
    
    loadCandidates();
  }, [selectedDate]);

  // Lọc học viên theo tìm kiếm
  const filteredCandidates = candidates.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.sbd.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Thống kê
  const stats = {
    total: filteredCandidates.length,
    passed: filteredCandidates.filter(c => c.exam_status === 'Pass').length,
    failed: filteredCandidates.filter(c => c.exam_status === 'Fail').length,
    notTested: filteredCandidates.filter(c => c.exam_status === 'Not_Tested').length,
    hasProfile: filteredCandidates.filter(c => c.has_profile).length,
    returnedGPLX: filteredCandidates.filter(c => c.gplx_status === 'Returned').length,
  };

  // Xử lý cập nhật mã hiệu từ file Excel
  const handleUpdateCode = async (file: File) => {
    if (!selectedDate) {
      setUpdateResult({ success: false, message: 'Vui lòng chọn ngày thi trước' });
      return;
    }

    setIsUpdatingCode(true);
    setUpdateResult(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      // Lấy sheet đầu tiên
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Chuyển thành JSON với header là số hàng
      const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      // Parse dữ liệu từ hàng 4 trở đi (index 3)
      const excelData: ExcelRow[] = [];
      for (let i = 3; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length === 0) continue;
        
        // Cột F (index 5) là mã hiệu
        const code = row[5] ? String(row[5]).trim() : '';
        
        // Cột H (index 7) có nội dung "1 TRẦN VĂN AN 01/02/1980"
        const colHContent = row[7] ? String(row[7]).trim() : '';
        
        if (!colHContent) continue;
        
        // Parse nội dung cột H: "1 TRẦN VĂN AN 01/02/1980"
        const parts = colHContent.split(/\s+/);
        const sbd = parts[0] || '';
        
        // Ngày sinh là phần cuối cùng (dd/mm/yyyy)
        const dateOfBirth = parts[parts.length - 1] || '';
        
        // Tên là phần ở giữa (từ index 1 đến length-2)
        const nameParts = parts.slice(1, parts.length - 1);
        const fullName = nameParts.join(' ') || '';
        
        if (sbd && fullName) {
          excelData.push({
            sbd,
            fullName,
            dateOfBirth,
            code,
          });
        }
      }

      if (excelData.length === 0) {
        setUpdateResult({ success: false, message: 'Không tìm thấy dữ liệu trong file Excel' });
        setIsUpdatingCode(false);
        return;
      }

      // Gọi API để cập nhật (Sử dụng chuẩn dd-MM-yyyy)
      const examDate = format(selectedDate, 'dd-MM-yyyy');
      const response = await fetch('/api/sheets/update-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examDate,
          excelData,
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        setUpdateResult({
          success: true,
          message: result.message,
          updatedCount: result.updatedCount,
          notFoundCount: result.notFoundCount,
        });
        
        // Reload dữ liệu sau khi cập nhật
        const refreshResponse = await fetch(`/api/sheets/data?date=${examDate}`);
        const refreshResult = await refreshResponse.json();
        if (refreshResult.success) {
          setCandidates(refreshResult.candidates || []);
        }
      } else {
        setUpdateResult({ success: false, message: result.error });
      }
    } catch (error: any) {
      console.error('Error updating code:', error);
      setUpdateResult({ success: false, message: error.message || 'Có lỗi xảy ra khi cập nhật' });
    } finally {
      setIsUpdatingCode(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleUpdateCode(file);
    }
  };

  // Xử lý xuất Excel danh sách GPLX trạng thái Chờ
  const handleExportPendingGPLX = async () => {
    if (!selectedDate) return;

    setIsExportingPending(true);
    try {
      // Lọc danh sách học viên có gplx_status = 'Pending' (Chờ)
      const pendingCandidates = candidates.filter(c => c.gplx_status === 'Pending');

      if (pendingCandidates.length === 0) {
        alert('Không có học viên nào có trạng thái GPLX "Chờ" cho ngày này.');
        setIsExportingPending(false);
        return;
      }

      // Tạo dữ liệu Excel
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

      // Sử dụng xlsx để tạo file Excel
      const XLSX = await import('xlsx');
      const worksheet = XLSX.utils.aoa_to_sheet(excelData);
      
      // Đặt độ rộng cột
      worksheet['!cols'] = [
        { wch: 12 },  // SBD
        { wch: 30 },  // Họ tên
        { wch: 15 },  // Ngày sinh
        { wch: 15 },  // Số điện thoại
        { wch: 25 },  // Nơi nhận
        { wch: 20 },  // Mã vận đơn
        { wch: 12 },  // Kết quả
        { wch: 15 },  // Đã nộp tiền
        { wch: 18 },  // Trạng thái GPLX
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Danh sách chưa có GPLX');

      // Xuất file
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const data = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      // Tạo tên file: Danh Sách Chưa Có GPLX ngày dd-MM-yyyy
      const fileName = `Danh Sách Chưa Có GPLX ngày ${format(selectedDate, 'dd-MM-yyyy')}.xlsx`;
      
      const { saveAs } = await import('file-saver');
      saveAs(data, fileName);
    } catch (error: any) {
      console.error('Error exporting pending GPLX:', error);
      alert('Có lỗi xảy ra khi xuất file Excel: ' + (error.message || 'Lỗi không xác định'));
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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {/* Chọn ngày thi */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                Chọn ngày thi
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

          {/* Tìm kiếm */}
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

          {/* Mở Google Sheets */}
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
        </motion.div>

        {/* Cập nhật mã hiệu từ Excel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-blue-700">
                <Upload className="h-4 w-4" />
                Cập nhật Mã Hiệu từ Excel
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Chọn file Excel có cấu trúc: hàng 4 trở đi, cột F là mã hiệu, cột H có nội dung "SBD Họ Tên Ngày Sinh"
              </p>
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={!selectedDate || isUpdatingCode}
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!selectedDate || isUpdatingCode}
                  className="flex-1"
                >
                  {isUpdatingCode ? (
                    <>
                      <span className="animate-spin mr-2">⏳</span>
                      Đang xử lý...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Chọn file Excel
                    </>
                  )}
                </Button>
              </div>
              
              {updateResult && (
                <div className={`p-3 rounded-md flex items-start gap-2 ${
                  updateResult.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {updateResult.success ? (
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  )}
                  <div className="text-sm">
                    <p className="font-medium">{updateResult.message}</p>
                    {updateResult.updatedCount !== undefined && (
                      <p className="text-xs mt-1">
                        ✓ Đã cập nhật: <strong>{updateResult.updatedCount}</strong> thí sinh
                        {updateResult.notFoundCount !== undefined && updateResult.notFoundCount > 0 && (
                          <span className="text-orange-600"> | Không tìm thấy: {updateResult.notFoundCount}</span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Danh sách sheets có sẵn */}
        {sheetsList.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  📋 Các ngày thi có dữ liệu ({sheetsList.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {sheetsList.map((sheet) => (
                    <Badge
                      key={sheet}
                      variant={
                        selectedDate &&
                        (format(selectedDate, 'dd-MM-yyyy') === sheet ||
                          format(selectedDate, 'yyyy-MM-dd') === sheet)
                          ? 'default'
                          : 'secondary'
                      }
                      className="cursor-pointer"
                      onClick={() => setSelectedDate(parseSheetDate(sheet))}
                    >
                      📅 {sheet}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Thống kê nhanh */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 lg:grid-cols-6 gap-4"
        >
          <StatCard label="Tổng HV" value={stats.total} color="from-blue-500 to-cyan-500" />
          <StatCard label="Đậu" value={stats.passed} color="from-emerald-500 to-teal-500" />
          <StatCard label="Rớt" value={stats.failed} color="from-red-500 to-orange-500" />
          <StatCard label="Chưa thi" value={stats.notTested} color="from-amber-500 to-yellow-500" />
          <StatCard label="Có hồ sơ" value={stats.hasProfile} color="from-purple-500 to-pink-500" />
          <StatCard label="Đã nhận GPLX" value={stats.returnedGPLX} color="from-indigo-500 to-violet-500" />
        </motion.div>

        {/* Bảng học viên */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Danh sách học viên
                  {selectedDate && (
                    <Badge variant="secondary">
                      {format(selectedDate, 'dd/MM/yyyy', { locale: vi })}
                    </Badge>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  {isLoading && <span className="text-sm text-muted-foreground">Đang tải...</span>}
                  {/* Button xuất Excel danh sách GPLX trạng thái Chờ */}
                  {selectedDate && (
                    <Button
                      onClick={handleExportPendingGPLX}
                      disabled={isExportingPending || filteredCandidates.length === 0}
                      size="sm"
                      variant="outline"
                    >
                      {isExportingPending ? (
                        <>
                          <span className="animate-spin mr-2">⏳</span>
                          Đang xuất...
                        </>
                      ) : (
                        <>
                          <Download className="mr-2 h-4 w-4" />
                          Xuất Excel GPLX Chờ
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredCandidates.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    {isLoading ? 'Đang tải dữ liệu...' : 'Không có học viên nào cho ngày này'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Hãy chọn ngày khác hoặc thêm dữ liệu vào Google Sheets
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-semibold">SBD</th>
                        <th className="text-left py-3 px-4 font-semibold">Họ tên</th>
                        <th className="text-left py-3 px-4 font-semibold">Ngày Sinh</th>
                        <th className="text-left py-3 px-4 font-semibold">Số Điện Thoại</th>
                        <th className="text-left py-3 px-4 font-semibold">Nơi Nhận</th>
                        <th className="text-left py-3 px-4 font-semibold">Mã Vận Đơn</th>
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
                            <Badge variant={candidate.has_profile ? 'default' : 'secondary'}>
                              {candidate.has_profile ? '✓' : '✗'}
                            </Badge>
                          </td>
                          <td className="text-center py-3 px-4">
                            <StatusBadge status={candidate.exam_status} />
                          </td>
                          <td className="text-center py-3 px-4">
                            <Badge variant={candidate.has_app_and_fee ? 'default' : 'secondary'}>
                              {candidate.has_app_and_fee ? '✓' : '✗'}
                            </Badge>
                          </td>
                          <td className="text-center py-3 px-4">
                            <Badge variant={candidate.gplx_status === 'Returned' ? 'default' : 'secondary'}>
                              {candidate.gplx_status === 'Returned' ? 'Đã về' : 'Chờ'}
                            </Badge>
                          </td>
                          <td className="text-center py-3 px-4">
                            <Badge variant={candidate.has_postal_up ? 'default' : 'secondary'}>
                              {candidate.has_postal_up ? '✓' : '✗'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
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
  
  return (
    <Badge className={`${config[status].color} text-white`}>
      {config[status].label}
    </Badge>
  );
}