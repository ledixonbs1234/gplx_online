// plx_online/components/FileUploader.tsx
'use client';

import { useState, useRef } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Upload, Calendar as CalendarIcon, ArrowRight, CheckCircle2, 
  AlertCircle, ChevronLeft, ArrowLeftRight, Settings, 
  FileSpreadsheet, Play, ListFilter
} from 'lucide-react';

interface FileUploaderProps {
  onUploadSuccess?: () => void;
}

const TARGET_FIELDS = [
  { key: 'sbd', label: 'Số báo danh (SBD)', required: true, keywords: ['sbd', 'mã hv', 'id', 'số bd', 'stt'] },
  { key: 'name', label: 'Họ và tên', required: true, keywords: ['họ tên', 'ho ten', 'name', 'tên', 'họ và tên'] },
  { key: 'date_of_birth', label: 'Ngày Sinh', required: false, keywords: ['ngày sinh', 'ngay sinh', 'ngày tháng', 'dob', 'date of birth', 'năm sinh', 'ngày tháng sinh', 'ngày tháng năm sinh'] },
  { key: 'phone', label: 'Số Điện Thoại', required: false, keywords: ['số điện thoại', 'so dien thoai', 'phone', 'điện thoại', 'dien thoai'] },
  { key: 'receive_location', label: 'Nơi Nhận bưu điện', required: false, keywords: ['nơi nhận', 'noi nhan', 'receive_location', 'nhận', 'địa chỉ', 'dia chi'] }, 
  { key: 'residence', label: 'Nơi Cư Trú', required: false, keywords: ['nơi cư trú', 'noi cu tru', 'residence'] }, 
  { key: 'tracking_number', label: 'Mã Vận Đơn', required: false, keywords: ['mã vận đơn', 'ma van don', 'tracking', 'số hiệu bg'] },
  { key: 'has_profile', label: 'Có Hồ Sơ', required: false, keywords: ['có hồ sơ', 'co ho so', 'has_profile'], isStatic: true },
  { key: 'exam_status', label: 'Kết quả thi', required: false, keywords: ['kết quả thi', 'ket qua thi', 'exam_status'], isStatic: true },
  { key: 'has_app_and_fee', label: 'Đã Nộp Tiền', required: false, keywords: ['đã nộp tiền', 'da nop tien', 'đk app + tiền', 'số tiền'], isStatic: true },
  { key: 'gplx_status', label: 'Trạng thái GPLX', required: false, keywords: ['trạng thái gplx', 'trang thai gplx', 'gplx_status'], isStatic: true }
];

export function FileUploader({ onUploadSuccess }: FileUploaderProps) {
  const [step, setStep] = useState<number>(1);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState('');
  
  const [sheets, setSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [rawRows, setRawRows] = useState<any[][]>([]);
  const [headerRowIdx, setHeaderRowIdx] = useState<number>(-1);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  
  const [fieldMap, setFieldMap] = useState<Record<string, number>>({});
  
  const [defaultValues, setDefaultValues] = useState<Record<string, any>>({
    has_profile: false,
    exam_status: 'Not_Tested',
    has_app_and_fee: false,
    gplx_status: 'Pending'
  });

  const [parsedPreview, setParsedPreview] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; content: string }>({ type: null, content: '' });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = async (file: File) => {
    setFileName(file.name);
    setStatus({ type: null, content: '' });

    try {
      const arrayBuffer = await file.arrayBuffer();
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      setSheets(workbook.SheetNames);
      
      const firstSheet = workbook.SheetNames[0];
      setSelectedSheet(firstSheet);
      loadSheetData(workbook, firstSheet);
    } catch (err: any) {
      setStatus({ type: 'error', content: 'Lỗi đọc file Excel: ' + err.message });
    }
  };

  const loadSheetData = async (workbook: any, sheetName: string) => {
    const XLSX = await import('xlsx');
    const worksheet = workbook.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    setRawRows(rows);

    const searchKeywords = ['sbd', 'họ tên', 'ngày sinh', 'đậu', 'rớt', 'điện thoại', 'địa chỉ', 'nơi cư trú'];
    let bestRowIdx = 0;
    let maxMatches = 0;

    rows.slice(0, 15).forEach((row, idx) => {
      if (!row || !Array.isArray(row)) return;
      let matches = 0;
      row.forEach(cell => {
        const text = String(cell || '').toLowerCase();
        if (searchKeywords.some(kw => text.includes(kw))) matches++;
      });
      if (matches > maxMatches) {
        maxMatches = matches;
        bestRowIdx = idx;
      }
    });

    setHeaderRowIdx(bestRowIdx);
    setStep(2);
  };

  const handleConfirmHeader = () => {
    if (headerRowIdx === -1) return;
    
    const rawHeaderRow = rawRows[headerRowIdx] || [];
    const headers = rawHeaderRow.map(h => String(h !== undefined && h !== null ? h : '').trim());
    setExcelHeaders(headers);

    const initialMapping: Record<string, number> = {};
    TARGET_FIELDS.forEach(field => {
      if (field.isStatic) return;
      
      const index = headers.findIndex(h => {
        const lowerH = String(h || '').toLowerCase().trim();
        return field.keywords.some(kw => lowerH === kw || lowerH.includes(kw));
      });
      initialMapping[field.key] = index;
    });

    setFieldMap(initialMapping);
    setStep(3);
  };

  const handleConfirmMapping = () => {
    if (fieldMap['sbd'] === -1 || fieldMap['name'] === -1) {
      alert('Vui lòng ghép nối tối thiểu hai cột bắt buộc: "Số báo danh (SBD)" và "Họ và tên"');
      return;
    }

    const previewData: any[] = [];
    const formattedDate = selectedDate ? format(selectedDate, 'dd-MM-yyyy') : '';

    const parseExcelDate = (val: any): string => {
      if (!val) return '';
      if (typeof val === 'number') {
        const utcDays = val - 25569;
        const dateObj = new Date(utcDays * 86400 * 1000);
        return format(dateObj, 'dd/MM/yyyy');
      }
      return String(val).trim();
    };

    const formatPhoneNumber = (val: any): string => {
      const rawVal = String(val || '').trim();
      if (!rawVal) return '';

      let clean = rawVal.replace(/[\s\.\-]/g, '');

      if (clean.length === 9 && /^[1-9]\d{8}$/.test(clean)) {
        clean = '0' + clean;
      }
      else if (clean.startsWith('84') && clean.length === 11) {
        clean = '0' + clean.slice(2);
      }
      else if (clean.startsWith('+84') && clean.length === 12) {
        clean = '0' + clean.slice(3);
      }

      return clean;
    };

    const parseBoolean = (val: any, fallback: boolean): boolean => {
      if (val === undefined || val === null || val === '') return fallback;
      const s = String(val).toLowerCase().trim();
      return ['có', 'co', 'yes', 'true', '1', 'x', 'đậu', 'về'].includes(s);
    };

    const parseExamStatus = (val: any, fallback: 'Pass' | 'Fail' | 'Not_Tested'): 'Pass' | 'Fail' | 'Not_Tested' => {
      if (!val) return fallback;
      const s = String(val).toLowerCase().trim();
      if (s.includes('rớt') || s.includes('fail') || s === '0') return 'Fail';
      if (s.includes('đậu') || s.includes('pass') || s === '1') return 'Pass';
      if (s.includes('chưa') || s.includes('not') || s.includes('biết')) return 'Not_Tested';
      return fallback;
    };

    const parseGplxStatus = (val: any, fallback: 'Returned' | 'Pending'): 'Returned' | 'Pending' => {
      if (!val) return fallback;
      const s = String(val).toLowerCase().trim();
      if (s.includes('về') || s.includes('returned') || s === 'x') return 'Returned';
      return 'Pending';
    };

    for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!row || row.length === 0) continue;

      const sbdVal = fieldMap['sbd'] !== -1 ? String(row[fieldMap['sbd']] || '').trim() : '';
      const nameVal = fieldMap['name'] !== -1 ? String(row[fieldMap['name']] || '').trim() : '';

      if (!sbdVal || !nameVal) continue; 

      const phoneVal = fieldMap['phone'] !== -1 ? formatPhoneNumber(row[fieldMap['phone']]) : '';

      let examStatusVal = fieldMap['exam_status'] !== undefined && fieldMap['exam_status'] !== -1 
        ? parseExamStatus(row[fieldMap['exam_status']], defaultValues.exam_status) 
        : defaultValues.exam_status;

      let hasAppAndFeeVal = fieldMap['has_app_and_fee'] !== undefined && fieldMap['has_app_and_fee'] !== -1 
        ? parseBoolean(row[fieldMap['has_app_and_fee']], defaultValues.has_app_and_fee) 
        : defaultValues.has_app_and_fee;

      // NÂNG CẤP ĐỒNG BỘ: Nếu có số điện thoại, kết quả thi tự động là "Pass" (Đậu) & trạng thái nộp tiền là true (Đã nộp)
      if (phoneVal !== '') {
        examStatusVal = 'Pass';
        hasAppAndFeeVal = true;
      }

      previewData.push({
        sbd: sbdVal,
        name: nameVal,
        date_of_birth: fieldMap['date_of_birth'] !== -1 ? parseExcelDate(row[fieldMap['date_of_birth']]) : '',
        phone: phoneVal,
        receive_location: fieldMap['receive_location'] !== -1 ? String(row[fieldMap['receive_location']] || '').trim() : '',
        residence: fieldMap['residence'] !== -1 ? String(row[fieldMap['residence']] || '').trim() : '',
        tracking_number: fieldMap['tracking_number'] !== -1 ? String(row[fieldMap['tracking_number']] || '').trim() : '',
        has_profile: fieldMap['has_profile'] !== undefined && fieldMap['has_profile'] !== -1 ? parseBoolean(row[fieldMap['has_profile']], defaultValues.has_profile) : defaultValues.has_profile,
        exam_status: examStatusVal,
        has_app_and_fee: hasAppAndFeeVal,
        gplx_status: fieldMap['gplx_status'] !== undefined && fieldMap['gplx_status'] !== -1 ? parseGplxStatus(row[fieldMap['gplx_status']], defaultValues.gplx_status) : defaultValues.gplx_status,
        exam_date: formattedDate
      });
    }

    setParsedPreview(previewData);
    setStep(4);
  };

  const handleUploadToGoogleSheets = async () => {
    if (!selectedDate || parsedPreview.length === 0) return;
    setIsUploading(true);
    setStatus({ type: null, content: '' });

    const formattedDate = format(selectedDate, 'dd-MM-yyyy');

    try {
      const response = await fetch('/api/sheets/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: formattedDate,
          candidates: parsedPreview
        })
      });

      const result = await response.json();

      if (result.success) {
        setStatus({ type: 'success', content: result.message });
        setTimeout(() => {
          setStep(1);
          setFileName('');
          setRawRows([]);
          setParsedPreview([]);
          if (onUploadSuccess) onUploadSuccess();
        }, 2000);
      } else {
        setStatus({ type: 'error', content: result.error || 'Xảy ra lỗi trong quá trình upload.' });
      }
    } catch (err: any) {
      setStatus({ type: 'error', content: 'Lỗi đồng bộ bưu điện: ' + err.message });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="glass shadow-xl border-primary/10">
      <CardHeader className="border-b pb-4">
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-green-600" />
          Nhập liệu và Ghép cột Excel Thông minh (Upload Wizard)
        </CardTitle>
        
        <div className="flex items-center gap-2 mt-2">
          <Badge variant={step === 1 ? 'default' : 'secondary'} className="text-[10px]">1. Chọn File & Ngày</Badge>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <Badge variant={step === 2 ? 'default' : 'secondary'} className="text-[10px]">2. Chọn dòng Tiêu đề</Badge>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <Badge variant={step === 3 ? 'default' : 'secondary'} className="text-[10px]">3. Kết nối cột</Badge>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <Badge variant={step === 4 ? 'default' : 'secondary'} className="text-[10px]">4. Kiểm tra & Lưu</Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        
        {/* STEP 1: CHỌN FILE VÀ NGÀY THI */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <label className="text-sm font-semibold flex items-center gap-2 shrink-0">
                <CalendarIcon className="h-4 w-4 text-primary" />
                Ghép nhận học viên cho ngày thi:
              </label>
              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[200px] justify-start text-left font-normal glass">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, 'dd-MM-yyyy') : <span>Chọn ngày</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      if (date) {
                        setSelectedDate(date);
                        setIsCalendarOpen(false);
                      }
                    }}
                    locale={vi}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div
              className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
                dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4 animate-bounce" />
              <p className="text-base font-semibold mb-1">Kéo thả file kết quả thi Excel vào đây</p>
              <p className="text-xs text-muted-foreground mb-4">Hoặc click để chọn file từ máy tính (.xlsx, .xls)</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button size="sm" variant="secondary" className="pointer-events-none">Chọn file</Button>
            </div>
          </div>
        )}

        {/* STEP 2: CHỌN DÒNG TIÊU ĐỀ */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground flex items-start gap-2">
              <Settings className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <strong>Mẹo:</strong> Hãy nhìn bảng dưới đây và <strong>bấm chọn hàng chứa tiêu đề chính</strong> (vd: SBD, Họ tên, Ngày tháng...). Hệ thống đã tự chọn dòng thích hợp nhất.
              </div>
            </div>

            <div className="max-h-80 overflow-auto border rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted font-bold sticky top-0">
                  <tr>
                    <th className="p-2 w-16 text-center">Chọn</th>
                    <th className="p-2 w-16 text-center">Hàng</th>
                    <th className="p-2">Nội dung xem trước các ô</th>
                  </tr>
                </thead>
                <tbody>
                  {rawRows.slice(0, 12).map((row, idx) => (
                    <tr 
                      key={idx} 
                      className={`border-t hover:bg-primary/5 cursor-pointer ${headerRowIdx === idx ? 'bg-primary/10 font-medium' : ''}`}
                      onClick={() => setHeaderRowIdx(idx)}
                    >
                      <td className="p-2 text-center">
                        <input 
                          type="radio" 
                          name="header_row" 
                          checked={headerRowIdx === idx}
                          onChange={() => setHeaderRowIdx(idx)}
                          className="accent-primary"
                        />
                      </td>
                      <td className="p-2 text-center text-muted-foreground">#{idx + 1}</td>
                      <td className="p-2 truncate max-w-[500px]">
                        <div className="flex gap-1 overflow-hidden whitespace-nowrap">
                          {(row || []).map((cell, cIdx) => (
                            <span key={cIdx} className="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded border text-[11px]">
                              {String(cell || '')}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-4 border-t">
              <Button variant="ghost" onClick={() => setStep(1)} size="sm">
                <ChevronLeft className="h-4 w-4 mr-1" /> Quay lại
              </Button>
              <Button onClick={handleConfirmHeader} size="sm">
                Tiếp tục ghép nối <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: MAPPING COLS */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-xs text-indigo-900 flex items-start gap-2">
              <ArrowLeftRight className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                Hệ thống tự động liên kết các cột tương ứng. Cột <strong>Nơi nhận bưu điện</strong> được đặt ưu tiên tự động liên kết với các cột chứa từ khóa địa chỉ.
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Ghép cột thực tế */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-200 border-b pb-1">Ghép cột từ file Excel</h3>
                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  {TARGET_FIELDS.map((field) => {
                    if (field.isStatic) return null;
                    return (
                      <div key={field.key} className="flex flex-col gap-1.5 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                        <div className="flex justify-between text-xs">
                          <span className="font-bold flex items-center gap-1 text-neutral-700 dark:text-neutral-300">
                            {field.label}
                            {field.required && <span className="text-red-500">*</span>}
                          </span>
                        </div>
                        <Select 
                          value={String(fieldMap[field.key] ?? -1)} 
                          onValueChange={(val) => setFieldMap(prev => ({ ...prev, [field.key]: Number(val) }))}
                        >
                          <SelectTrigger className="h-9 glass">
                            <SelectValue placeholder="Bỏ qua / Không ghép nối" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="-1">
                              <span className="text-muted-foreground italic">--- Không ghép nối / Bỏ qua ---</span>
                            </SelectItem>
                            {excelHeaders.map((header, hIdx) => (
                              <SelectItem key={hIdx} value={String(hIdx)}>
                                Cột {hIdx + 1}: {header || '(Trống)'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Cấu hình giá trị mặc định cho cột thiếu */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-200 border-b pb-1 flex items-center gap-2">
                  <ListFilter className="h-4 w-4 text-primary" />
                  Cấu hình giá trị mặc định (Nếu file Excel thiếu cột)
                </h3>
                
                <div className="space-y-4 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/40 border">
                  
                  {/* Hồ sơ */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">1. Có Hồ Sơ mặc định</span>
                    <Select 
                      value={String(defaultValues.has_profile)} 
                      onValueChange={(v) => setDefaultValues(prev => ({ ...prev, has_profile: v === 'true' }))}
                    >
                      <SelectTrigger className="h-9 bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Có hồ sơ</SelectItem>
                        <SelectItem value="false">Không có hồ sơ</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Kết quả thi */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">2. Kết quả thi mặc định</span>
                    <Select 
                      value={defaultValues.exam_status} 
                      onValueChange={(v) => setDefaultValues(prev => ({ ...prev, exam_status: v }))}
                    >
                      <SelectTrigger className="h-9 bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pass">Đậu</SelectItem>
                        <SelectItem value="Fail">Rớt</SelectItem>
                        <SelectItem value="Not_Tested">Chưa biết</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Đóng tiền */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">3. Đã nộp tiền mặc định</span>
                    <Select 
                      value={String(defaultValues.has_app_and_fee)} 
                      onValueChange={(v) => setDefaultValues(prev => ({ ...prev, has_app_and_fee: v === 'true' }))}
                    >
                      <SelectTrigger className="h-9 bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Đã nộp tiền</SelectItem>
                        <SelectItem value="false">Chưa nộp tiền</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Trạng thái GPLX */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">4. Trạng thái GPLX mặc định</span>
                    <Select 
                      value={defaultValues.gplx_status} 
                      onValueChange={(v) => setDefaultValues(prev => ({ ...prev, gplx_status: v }))}
                    >
                      <SelectTrigger className="h-9 bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pending">Chờ GPLX</SelectItem>
                        <SelectItem value="Returned">Đã về</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                </div>
              </div>

            </div>

            <div className="flex justify-between items-center pt-4 border-t">
              <Button variant="ghost" onClick={() => setStep(2)} size="sm">
                <ChevronLeft className="h-4 w-4 mr-1" /> Quay lại
              </Button>
              <Button onClick={handleConfirmMapping} size="sm">
                Xem trước kết quả bốc tách <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: PREVIEW & UPLOAD */}
        {step === 4 && (
          <div className="space-y-5">
            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-xs text-emerald-900 flex items-center justify-between">
              <span className="font-semibold flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Hệ thống bốc tách thành công {parsedPreview.length} học viên từ file Excel!
              </span>
              <Badge variant="outline" className="bg-white border-emerald-200">
                Ngày thi: {selectedDate ? format(selectedDate, 'dd-MM-yyyy') : ''}
              </Badge>
            </div>

            <div className="border rounded-lg max-h-72 overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted font-bold sticky top-0">
                  <tr className="border-b">
                    <th className="p-2">SBD</th>
                    <th className="p-2">Họ và tên</th>
                    <th className="p-2">Ngày Sinh</th>
                    <th className="p-2">Số Điện thoại</th>
                    <th className="p-2">Nơi Nhận</th>
                    <th className="p-2">Nơi cư trú</th>
                    <th className="p-2">Vận đơn</th>
                    <th className="p-2 text-center">Hồ Sơ</th>
                    <th className="p-2 text-center">Thi</th>
                    <th className="p-2 text-center">Học phí</th>
                    <th className="p-2 text-center">GPLX</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedPreview.slice(0, 6).map((item, idx) => (
                    <tr key={idx} className="border-b hover:bg-muted/40">
                      <td className="p-2 font-mono font-bold text-primary">{item.sbd}</td>
                      <td className="p-2 font-semibold">{item.name}</td>
                      <td className="p-2">{item.date_of_birth || '-'}</td>
                      <td className="p-2">{item.phone || '-'}</td>
                      <td className="p-2 truncate max-w-[100px]">{item.receive_location || '-'}</td>
                      <td className="p-2 truncate max-w-[100px]">{item.residence || '-'}</td>
                      <td className="p-2 font-mono">{item.tracking_number || '-'}</td>
                      <td className="p-2 text-center">{item.has_profile ? '✓' : '✗'}</td>
                      <td className="p-2 text-center">
                        <Badge variant={item.exam_status === 'Pass' ? 'default' : item.exam_status === 'Fail' ? 'destructive' : 'secondary'} className="text-[10px] px-1 h-4">
                          {item.exam_status === 'Pass' ? 'Đậu' : item.exam_status === 'Fail' ? 'Rớt' : 'Chưa biết'}
                        </Badge>
                      </td>
                      <td className="p-2 text-center">{item.has_app_and_fee ? '✓' : '✗'}</td>
                      <td className="p-2 text-center">
                        <Badge variant={item.gplx_status === 'Returned' ? 'outline' : 'secondary'} className="text-[10px] px-1 h-4">
                          {item.gplx_status === 'Returned' ? 'Đã về' : 'Chờ'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {parsedPreview.length > 6 && (
                    <tr>
                      <td colSpan={11} className="p-2 bg-muted/20 text-center text-muted-foreground italic text-[11px]">
                        Và thêm {parsedPreview.length - 6} học viên nữa...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {status.content && (
              <div className={`p-4 rounded-lg flex items-start gap-2 text-sm ${
                status.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'
              }`}>
                {status.type === 'success' ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
                <span className="font-semibold">{status.content}</span>
              </div>
            )}

            <div className="flex justify-between items-center pt-4 border-t">
              <Button variant="ghost" onClick={() => setStep(3)} size="sm">
                <ChevronLeft className="h-4 w-4 mr-1" /> Quay lại
              </Button>
              <Button 
                onClick={handleUploadToGoogleSheets} 
                disabled={isUploading}
                className="bg-green-700 hover:bg-green-800 text-white font-bold"
              >
                {isUploading ? (
                  <>
                    <Play className="h-4 w-4 mr-2 animate-spin" />
                    ĐANG TIẾN HÀNH ĐỒNG BỘ GOOGLE SHEETS & ĐỊNH DẠNG...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-1.5" />
                    BẮT ĐẦU TẢI LÊN & ĐỊNH DẠNG GOOGLE SHEETS
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
}