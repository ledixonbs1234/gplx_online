// plx_online/app/(dashboard)/candidates/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar as CalendarIcon, 
  Users, 
  FileSpreadsheet, 
  Search, 
  ExternalLink, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Trash2,
  SlidersHorizontal,
  X,
  ChevronDown,
  ChevronUp,
  Phone,
  MapPin
} from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface Candidate {
  sbd: string;
  name: string;
  date_of_birth?: string;
  phone?: string;
  receive_location?: string;
  residence?: string;
  tracking_number?: string;
  exam_date: string;
  has_profile: boolean;
  exam_status: 'Pass' | 'Fail' | 'Not_Tested';
  has_app_and_fee: boolean;
  gplx_status: 'Returned' | 'Pending';
}

interface ExcelRow {
  sbd: string;
  fullName: string;
  dateOfBirth?: string;
  code?: string;
}

interface IncompleteRecord {
  rawText: string;
  sbd: string;
  fullName: string;
  dateOfBirth: string;
  code: string;
  selectedSheet: string;
  recordKey?: string;
}

const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1LhWQJVepItW3Ag-vDGsZgmH4rX_TicLtVwD-y696bgk/edit?usp=sharing';

function parseRecipient(text: string) {
  const cleaned = text.trim();
  if (!cleaned) return { sbd: '', name: '', dob: '', isValid: false };

  let sbd = '';
  let dob = '';
  let name = '';

  const tokens = cleaned.split(/\s+/);

  const dobIndex = tokens.findIndex(t => t.includes('/') && /\d/.test(t));
  if (dobIndex !== -1) {
    const rawDob = tokens[dobIndex];
    const cleanDob = rawDob.replace(/[^\d/]/g, '');
    const dateParts = cleanDob.split('/');
    
    if (dateParts.length === 3) {
      let day = dateParts[0].trim();
      let month = dateParts[1].trim();
      let year = dateParts[2].trim();

      if (day.length === 1) day = '0' + day;
      else if (day.length > 2) day = day.slice(-2);

      if (month.length === 1) month = '0' + month;
      else if (month.length > 2) month = month.slice(-2);

      if (year.length === 2) {
        const yNum = parseInt(year, 10);
        year = (yNum > 30 ? '19' : '20') + year;
      } else if (year.length === 1) {
        year = '200' + year;
      } else if (year.length === 3) {
        year = '2' + year;
      }

      if (day.length === 2 && month.length === 2 && year.length === 4) {
        dob = `${day}/${month}/${year}`;
      } else {
        dob = cleanDob;
      }
    } else {
      dob = cleanDob;
    }
    tokens.splice(dobIndex, 1);
  }

  const sbdIndex = tokens.findIndex(t => /^\d{1,4}$/.test(t));
  if (sbdIndex !== -1) {
    sbd = tokens[sbdIndex];
    tokens.splice(sbdIndex, 1);
  }

  const nameParts = tokens.filter(t => !/\d/.test(t) && /[a-zA-Zà-ỹÀ-ỸđĐ]/.test(t));
  name = nameParts.join(' ').trim();

  const hasSbd = sbd !== '';
  const hasName = name !== '' && name.length >= 2;
  const hasDob = dob !== '' && dob.includes('/');

  const isValid = hasSbd && hasName && hasDob;

  return { sbd, name, dob, isValid };
}

export default function CandidatesPage() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sheetsList, setSheetsList] = useState<string[]>([]);
  
  // --- Các States bộ lọc tìm kiếm đa điều kiện ---
  const [searchTerm, setSearchTerm] = useState(''); // Lọc Họ tên / SBD
  const [filterPhoneCode, setFilterPhoneCode] = useState(''); // Lọc Số điện thoại / Mã vận đơn
  const [filterAddress, setFilterAddress] = useState(''); // Lọc Nơi nhận / Nơi cư trú
  const [filterExamStatus, setFilterExamStatus] = useState<string>('all'); // Lọc kết quả thi
  const [filterHasProfile, setFilterHasProfile] = useState<string>('all'); // Lọc hồ sơ
  const [filterHasFee, setFilterHasFee] = useState<string>('all'); // Lọc đóng tiền
  const [filterGplxStatus, setFilterGplxStatus] = useState<string>('all'); // Lọc GPLX
  const [showAdvanced, setShowAdvanced] = useState(false); // Trạng thái mở rộng bộ lọc
  
  const [isUpdatingCode, setIsUpdatingCode] = useState(false);
  const [updateResult, setUpdateResult] = useState<{ success: boolean; message: string; updatedCount?: number } | null>(null);
  
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [incompleteRecords, setIncompleteRecords] = useState<IncompleteRecord[]>([]);
  const [unmatched, setUnmatched] = useState<any[]>([]);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isResolvingIncomplete, setIsResolvingIncomplete] = useState<number | null>(null);
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

  const loadStoredRecords = async () => {
    try {
      const response = await fetch('/api/sheets/update-code');
      const result = await response.json();
      if (result.success) {
        setConflicts(result.conflicts || []);
        setIncompleteRecords(result.incompleteRecords || []);
        setUnmatched(result.unmatched || []);
      }
    } catch (error) {
      console.error('Lỗi khi nạp dữ liệu lưu trữ từ DB:', error);
    }
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
    loadStoredRecords();
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

  // --- Kiểm tra xem có đang áp dụng bất kỳ bộ lọc nào không ---
  const hasAnyFilterApplied = 
    searchTerm !== '' || 
    filterPhoneCode !== '' || 
    filterAddress !== '' || 
    filterExamStatus !== 'all' || 
    filterHasProfile !== 'all' || 
    filterHasFee !== 'all' || 
    filterGplxStatus !== 'all';

  // --- Reset tất cả bộ lọc về trạng thái ban đầu ---
  const handleResetFilters = () => {
    setSearchTerm('');
    setFilterPhoneCode('');
    setFilterAddress('');
    setFilterExamStatus('all');
    setFilterHasProfile('all');
    setFilterHasFee('all');
    setFilterGplxStatus('all');
  };

  // --- Thực hiện lọc dữ liệu dựa trên nhiều điều kiện (Multi-Field Filtering) ---
  const filteredCandidates = candidates.filter(c => {
    // 1. Tìm theo Họ tên hoặc Số báo danh
    const matchNameSbd = !searchTerm.trim() || 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.sbd.toLowerCase().includes(searchTerm.toLowerCase());

    // 2. Tìm theo Số điện thoại hoặc Mã vận đơn bưu điện
    const matchPhoneCode = !filterPhoneCode.trim() ||
      (c.phone && c.phone.toLowerCase().includes(filterPhoneCode.toLowerCase())) ||
      (c.tracking_number && c.tracking_number.toLowerCase().includes(filterPhoneCode.toLowerCase()));

    // 3. Tìm theo Địa chỉ nhận hoặc Nơi cư trú
    const matchAddress = !filterAddress.trim() ||
      (c.receive_location && c.receive_location.toLowerCase().includes(filterAddress.toLowerCase())) ||
      (c.residence && c.residence.toLowerCase().includes(filterAddress.toLowerCase()));

    // 4. Lọc theo Kết quả thi
    const matchExamStatus = filterExamStatus === 'all' || c.exam_status === filterExamStatus;

    // 5. Lọc theo Hồ sơ
    const matchProfile = filterHasProfile === 'all' || 
      (filterHasProfile === 'true' && c.has_profile) || 
      (filterHasProfile === 'false' && !c.has_profile);

    // 6. Lọc theo Đăng ký app & Đã nộp tiền
    const matchFee = filterHasFee === 'all' || 
      (filterHasFee === 'true' && c.has_app_and_fee) || 
      (filterHasFee === 'false' && !c.has_app_and_fee);

    // 7. Lọc theo Trạng thái GPLX
    const matchGplx = filterGplxStatus === 'all' || c.gplx_status === filterGplxStatus;

    return matchNameSbd && matchPhoneCode && matchAddress && matchExamStatus && matchProfile && matchFee && matchGplx;
  });

  const stats = {
    total: filteredCandidates.length,
    passed: filteredCandidates.filter(c => c.exam_status === 'Pass').length,
    failed: filteredCandidates.filter(c => c.exam_status === 'Fail').length,
    notTested: filteredCandidates.filter(c => c.exam_status === 'Not_Tested').length,
    hasProfile: filteredCandidates.filter(c => c.has_profile).length,
    returnedGPLX: filteredCandidates.filter(c => c.gplx_status === 'Returned').length,
  };

  const handleReEvaluateConflicts = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/sheets/update-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 're_evaluate' }),
      });
      const result = await response.json();
      if (result.success) {
        alert(result.message);
        await loadStoredRecords();
        await loadCandidates();
      } else {
        alert(`Lỗi: ${result.error}`);
      }
    } catch (error) {
      console.error(error);
      alert('Không thể thực hiện kết nối làm mới xung đột.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleUpdateCode = async (file: File) => {
    setIsUpdatingCode(true);
    setUpdateResult(null);
    setConflicts([]);
    setUnmatched([]);
    setIncompleteRecords([]);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      const excelData: ExcelRow[] = [];
      const incompleteList: IncompleteRecord[] = [];
      const defaultDateStr = selectedDate ? format(selectedDate, 'dd-MM-yyyy') : (sheetsList[0] || '');

      for (let i = 2; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length === 0) continue;
        
        const recipientVal = row[4] ? String(row[4]).trim() : '';
        if (!recipientVal) continue;

        const code = row[12] ? String(row[12]).trim() : '';
        const parsed = parseRecipient(recipientVal);
        
        if (parsed.isValid) {
          excelData.push({
            sbd: parsed.sbd,
            fullName: parsed.name,
            dateOfBirth: parsed.dob,
            code,
          });
        } else {
          incompleteList.push({
            rawText: recipientVal,
            sbd: parsed.sbd || '',
            fullName: parsed.name || '',
            dateOfBirth: parsed.dob || '',
            code,
            selectedSheet: defaultDateStr,
          });
        }
      }

      if (excelData.length === 0 && incompleteList.length === 0) {
        setUpdateResult({ success: false, message: 'Không tìm thấy dữ liệu khả dụng từ hàng 3 trở đi trong file Excel' });
        setIsUpdatingCode(false);
        return;
      }

      const response = await fetch('/api/sheets/update-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ excelData, incompleteData: incompleteList }),
      });

      const result = await response.json();
      
      if (result.success) {
        setUpdateResult({
          success: true,
          message: `Phân tích hoàn tất! Đã cập nhật ${result.autoUpdatedCount} học viên khớp duy nhất. Toàn bộ các bản ghi xung đột, không khớp, và thiếu thông tin khác đã được lưu trữ vĩnh viễn trên Database.`,
          updatedCount: result.autoUpdatedCount,
        });
        
        await loadStoredRecords();
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

  const handleResolveConflict = async (sheetName: string, sbd: string, code: string, conflictIndex: number, conflictKey: string) => {
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
          conflictKey
        }),
      });
      const result = await response.json();
      if (result.success) {
        alert(result.message);
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

  const handleResolveIncomplete = async (index: number) => {
    const record = incompleteRecords[index];
    if (!record.sbd.trim() && !record.fullName.trim()) {
      alert('Vui lòng điền Số báo danh (SBD) hoặc Họ và Tên để có thể xác định học viên!');
      return;
    }
    if (!record.selectedSheet) {
      alert('Vui lòng chọn ngày thi chứa dữ liệu học viên cần cập nhật!');
      return;
    }

    setIsResolvingIncomplete(index);
    try {
      const response = await fetch('/api/sheets/update-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resolve_conflict',
          sheetName: record.selectedSheet,
          sbd: record.sbd.trim() || undefined,
          fullName: record.fullName.trim() || undefined,
          code: record.code,
          recordKey: record.recordKey,
        }),
      });
      const result = await response.json();
      if (result.success) {
        alert(result.message || 'Cập nhật mã hiệu thủ công thành công!');
        setIncompleteRecords(prev => prev.filter((_, idx) => idx !== index));
        await loadCandidates();
      } else {
        alert(`Lỗi: ${result.error}`);
      }
    } catch (error) {
      console.error(error);
      alert('Không thể lưu mã hiệu bưu điện thủ công');
    } finally {
      setIsResolvingIncomplete(null);
    }
  };

  const handleDeleteConflict = async (conflictKey: string, index: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa bản ghi xung đột này? (Dữ liệu học viên gốc trên Google Sheets vẫn được giữ nguyên)')) return;

    try {
      const response = await fetch('/api/sheets/update-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_conflict', conflictKey }),
      });
      const result = await response.json();
      if (result.success) {
        setConflicts(prev => prev.filter((_, idx) => idx !== index));
      } else {
        alert(`Lỗi: ${result.error}`);
      }
    } catch (error) {
      console.error(error);
      alert('Lỗi khi thực hiện xóa xung đột.');
    }
  };

  const handleDeleteAllConflicts = async () => {
    if (!confirm('Bạn có chắc chắn muốn xóa TOÀN BỘ danh sách trùng khớp xung đột?')) return;

    try {
      const response = await fetch('/api/sheets/update-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_all_conflicts' }),
      });
      const result = await response.json();
      if (result.success) {
        setConflicts([]);
      } else {
        alert(`Lỗi: ${result.error}`);
      }
    } catch (error) {
      console.error(error);
      alert('Lỗi khi thực hiện dọn dẹp danh sách xung đột.');
    }
  };

  const handleDeleteIncomplete = async (recordKey: string, index: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa bản ghi thiếu thông tin này khỏi danh sách Database?')) return;

    try {
      const response = await fetch('/api/sheets/update-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_incomplete_record', recordKey }),
      });
      const result = await response.json();
      if (result.success) {
        setIncompleteRecords(prev => prev.filter((_, idx) => idx !== index));
      } else {
        alert(`Lỗi: ${result.error}`);
      }
    } catch (error) {
      console.error(error);
      alert('Lỗi kết nối khi xóa bản ghi.');
    }
  };

  const handleDeleteAllIncomplete = async () => {
    if (!confirm('Bạn có chắc chắn muốn xóa TOÀN BỘ danh sách thiếu thông tin đã lưu trữ?')) return;

    try {
      const response = await fetch('/api/sheets/update-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_all_incomplete_records' }),
      });
      const result = await response.json();
      if (result.success) {
        setIncompleteRecords([]);
      } else {
        alert(`Lỗi: ${result.error}`);
      }
    } catch (error) {
      console.error(error);
      alert('Lỗi kết nối khi dọn sạch danh sách.');
    }
  };

  const handleDeleteUnmatched = async (unmatchedKey: string, index: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa bản ghi không tồn tại này khỏi danh sách Database?')) return;

    try {
      const response = await fetch('/api/sheets/update-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_unmatched_record', unmatchedKey }),
      });
      const result = await response.json();
      if (result.success) {
        setUnmatched(prev => prev.filter((_, idx) => idx !== index));
      } else {
        alert(`Lỗi: ${result.error}`);
      }
    } catch (error) {
      console.error(error);
      alert('Lỗi kết nối khi xóa bản ghi.');
    }
  };

  const handleDeleteAllUnmatched = async () => {
    if (!confirm('Bạn có chắc chắn muốn xóa TOÀN BỘ danh sách học viên không tồn tại trong hệ thống?')) return;

    try {
      const response = await fetch('/api/sheets/update-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_all_unmatched_records' }),
      });
      const result = await response.json();
      if (result.success) {
        setUnmatched([]);
      } else {
        alert(`Lỗi: ${result.error}`);
      }
    } catch (error) {
      console.error(error);
      alert('Lỗi kết nối khi dọn sạch danh sách.');
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
        ['SBD', 'Họ Tên', 'Ngày Sinh', 'Số Điện Thoại', 'Nơi Nhận', 'Nơi Cư Trú', 'Mã Vận Đơn', 'Kết Quả', 'Đã Nộp Tiền', 'Trạng Thái GPLX'],
        ...pendingCandidates.map((c) => [
          c.sbd,
          c.name,
          c.date_of_birth || '',
          c.phone || '',
          c.receive_location || '',
          c.residence || '',
          c.tracking_number || '',
          c.exam_status === 'Pass' ? 'Đậu' : c.exam_status === 'Fail' ? 'Rớt' : 'Chưa thi',
          c.has_app_and_fee ? 'Đã Nộp' : 'Chưa Nộp',
          'Chờ',
        ]),
      ];

      const XLSX = await import('xlsx');
      const worksheet = XLSX.utils.aoa_to_sheet(excelData);
      
      worksheet['!cols'] = [
        { wch: 12 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 25 }, { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 18 }
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
        
        {/* Hàng 1: Thao tác & Đồng bộ ngày thi */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

        {/* Bảng điều khiển bộ lọc tìm kiếm đa điều kiện nâng cao */}
        <Card className="border-indigo-100 bg-indigo-50/10">
          <CardHeader className="pb-3 flex flex-row items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-indigo-700">
              <SlidersHorizontal className="h-4 w-4" />
              Bộ lọc tìm kiếm đa điều kiện
            </CardTitle>
            <div className="flex gap-2">
              {hasAnyFilterApplied && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleResetFilters}
                  className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <X className="h-3 w-3 mr-1" />
                  Xóa bộ lọc
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="h-8 text-xs font-semibold"
              >
                {showAdvanced ? (
                  <span className="flex items-center gap-1">Thu gọn <ChevronUp className="h-3.5 w-3.5" /></span>
                ) : (
                  <span className="flex items-center gap-1">Mở rộng lọc nâng cao <ChevronDown className="h-3.5 w-3.5" /></span>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Bộ lọc văn bản chính */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Tên hoặc SBD học viên</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Nhập tên hoặc SBD..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">SĐT hoặc Mã vận đơn</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Nhập số điện thoại hoặc mã bưu..."
                    value={filterPhoneCode}
                    onChange={(e) => setFilterPhoneCode(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Nơi nhận hoặc Nơi cư trú</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Nhập xã, phường, địa chỉ cư trú..."
                    value={filterAddress}
                    onChange={(e) => setFilterAddress(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
              </div>
            </div>

            {/* Các trường lọc thả xuống khi người dùng mở rộng */}
            {showAdvanced && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-dashed border-indigo-100 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Kết quả thi</label>
                  <Select value={filterExamStatus} onValueChange={setFilterExamStatus}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Tất cả" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả kết quả</SelectItem>
                      <SelectItem value="Pass">Đậu</SelectItem>
                      <SelectItem value="Fail">Rớt</SelectItem>
                      <SelectItem value="Not_Tested">Chưa thi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Trạng thái hồ sơ</label>
                  <Select value={filterHasProfile} onValueChange={setFilterHasProfile}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Tất cả" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả trạng thái</SelectItem>
                      <SelectItem value="true">Có hồ sơ</SelectItem>
                      <SelectItem value="false">Không hồ sơ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Đăng ký app & Nộp tiền</label>
                  <Select value={filterHasFee} onValueChange={setFilterHasFee}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Tất cả" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả trạng thái</SelectItem>
                      <SelectItem value="true">Đã nộp tiền</SelectItem>
                      <SelectItem value="false">Chưa nộp tiền</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Trạng thái GPLX</label>
                  <Select value={filterGplxStatus} onValueChange={setFilterGplxStatus}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Tất cả" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả trạng thái</SelectItem>
                      <SelectItem value="Returned">Đã về (Đã nhận)</SelectItem>
                      <SelectItem value="Pending">Chờ GPLX (Chờ nhận)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Giao diện nạp/đối chiếu file bưu điện */}
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-blue-700">
              <Upload className="h-4 w-4" />
              Cập nhật Mã Hiệu bưu điện từ Excel (Đối chiếu toàn bộ hệ thống)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-xs text-muted-foreground space-y-1">
              <p>📍 <strong>Tiêu chí nhận diện tự động:</strong></p>
              <ul className="list-disc list-inside pl-2">
                <li><strong>SBD:</strong> Dạng số, tối đa 4 ký tự.</li>
                <li><strong>Họ Tên:</strong> Dạng chữ cái không chứa số.</li>
                <li><strong>Ngày Sinh:</strong> Chứa ký tự <code>/</code>, tự động chuẩn hóa thành <code>dd/MM/yyyy</code>.</li>
              </ul>
              <p className="mt-1">Dữ liệu bốc tách từ <strong>Hàng 3, cột E (Người nhận)</strong> và mã vận đơn ở <strong>cột M (Số hiệu BG)</strong>.</p>
            </div>
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

        {/* Danh sách các bản ghi thiếu thông tin (< 3 trường) cần xử lý thủ công */}
        {incompleteRecords.length > 0 && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2 flex-wrap gap-2">
              <div>
                <CardTitle className="text-amber-800 text-base font-bold flex items-center gap-2">
                  ⚠️ Bản ghi thiếu thông tin - Cần xử lý thủ công ({incompleteRecords.length})
                </CardTitle>
                <p className="text-xs text-amber-700">
                  Các bản ghi dưới đây không chứa đủ 3 trường dữ liệu tiêu chuẩn. Bạn vui lòng bổ sung thông tin chính xác, chọn ngày thi hợp lệ và bấm lưu:
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteAllIncomplete}
                className="font-bold flex items-center gap-1.5"
              >
                <Trash2 className="h-4 w-4" />
                Xóa tất cả
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-amber-100 text-amber-900 sticky top-0">
                    <tr className="text-left">
                      <th className="py-2 px-3">Dữ liệu thô Excel</th>
                      <th className="py-2 px-3">Số báo danh (SBD)</th>
                      <th className="py-2 px-3">Họ và Tên</th>
                      <th className="py-2 px-3">Ngày Sinh</th>
                      <th className="py-2 px-3">Mã Hiệu (Cột M)</th>
                      <th className="py-2 px-3">Ngày thi</th>
                      <th className="py-2 px-3 text-center">Thao tác</th>
                      <th className="py-2 px-3 text-center">Xóa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incompleteRecords.map((record, idx) => (
                      <tr key={idx} className="border-b border-amber-200 hover:bg-amber-100/30">
                        <td className="py-2 px-3 text-xs font-mono max-w-[200px] truncate" title={record.rawText}>
                          {record.rawText}
                        </td>
                        <td className="py-2 px-3">
                          <Input
                            placeholder="Nhập SBD"
                            value={record.sbd}
                            className="w-24 bg-white h-8 text-xs font-mono"
                            onChange={(e) => {
                              const updated = [...incompleteRecords];
                              updated[idx].sbd = e.target.value;
                              setIncompleteRecords(updated);
                            }}
                          />
                        </td>
                        <td className="py-2 px-3">
                          <Input
                            placeholder="Nhập Tên"
                            value={record.fullName}
                            className="w-40 bg-white h-8 text-xs"
                            onChange={(e) => {
                              const updated = [...incompleteRecords];
                              updated[idx].fullName = e.target.value;
                              setIncompleteRecords(updated);
                            }}
                          />
                        </td>
                        <td className="py-2 px-3">
                          <Input
                            placeholder="dd/MM/yyyy"
                            value={record.dateOfBirth}
                            className="w-28 bg-white h-8 text-xs"
                            onChange={(e) => {
                              const updated = [...incompleteRecords];
                              updated[idx].dateOfBirth = e.target.value;
                              setIncompleteRecords(updated);
                            }}
                          />
                        </td>
                        <td className="py-2 px-3 font-mono text-xs">{record.code || '-'}</td>
                        <td className="py-2 px-3">
                          <Select
                            value={record.selectedSheet}
                            onValueChange={(val) => {
                              const updated = [...incompleteRecords];
                              updated[idx].selectedSheet = val;
                              setIncompleteRecords(updated);
                            }}
                          >
                            <SelectTrigger className="w-32 bg-white h-8 text-xs">
                              <SelectValue placeholder="Chọn ngày thi" />
                            </SelectTrigger>
                            <SelectContent>
                              {sheetsList.map((sheet) => (
                                <SelectItem key={sheet} value={sheet} className="text-xs">
                                  {sheet}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <Button
                            size="sm"
                            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs h-8 px-3"
                            onClick={() => handleResolveIncomplete(idx)}
                            disabled={isResolvingIncomplete === idx}
                          >
                            {isResolvingIncomplete === idx ? '⏳' : 'Lưu'}
                          </Button>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-100/50"
                            onClick={() => handleDeleteIncomplete(record.recordKey || '', idx)}
                            title="Xóa bản ghi thiếu thông tin"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Danh sách xung đột trùng khớp nhiều ngày thi */}
        {conflicts.length > 0 && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2 flex-wrap gap-2">
              <div>
                <CardTitle className="text-amber-800 text-base font-bold flex items-center gap-2">
                  ⚠️ Phát hiện trùng khớp thông tin trên nhiều ngày thi ({conflicts.length})
                </CardTitle>
                <p className="text-xs text-amber-700">
                  Hệ thống lưu trữ các xung đột này. Bạn hãy bấm chọn ngày thi chính xác để lưu hoặc chạy lại đối chiếu:
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReEvaluateConflicts}
                  disabled={isRefreshing}
                  className="bg-white border-amber-300 hover:bg-amber-100 text-amber-800 font-bold"
                >
                  {isRefreshing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                      Đang quét...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-1.5" />
                      Làm mới & Chạy lại
                    </>
                  )}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteAllConflicts}
                  className="font-bold flex items-center gap-1.5"
                >
                  <Trash2 className="h-4 w-4" />
                  Xóa tất cả
                </Button>
              </div>
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
                      <th className="py-2 px-3 text-center">Xóa</th>
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
                                onClick={() => handleResolveConflict(match.sheetName, match.sbd, conflict.excelRow.code, idx, conflict.conflictKey)}
                                disabled={isResolvingConflict === resolveId}
                              >
                                {isResolvingConflict === resolveId ? '⏳...' : `📅 ${match.sheetName}`}
                              </Button>
                            );
                          })}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-100/50"
                            onClick={() => handleDeleteConflict(conflict.conflictKey, idx)}
                            title="Xóa xung đột này"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {unmatched.length > 0 && (
          <Card className="border-red-200 bg-red-50/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2 flex-wrap gap-2">
              <div>
                <CardTitle className="text-red-800 text-base font-bold flex items-center gap-2">
                  ❌ Thí sinh tải lên không tìm thấy trong cơ sở dữ liệu ({unmatched.length})
                </CardTitle>
                <p className="text-xs text-red-700">
                  Các thí sinh này không khớp bất kỳ thông tin nào trong toàn bộ lịch sử các ngày thi:
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteAllUnmatched}
                className="font-bold flex items-center gap-1.5"
              >
                <Trash2 className="h-4 w-4" />
                Xóa tất cả
              </Button>
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
                      <th className="py-2 px-3 text-center">Xóa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unmatched.map((row, idx) => (
                      <tr key={idx} className="border-b border-red-200 hover:bg-red-100/30">
                        <td className="py-2 px-3 font-mono">{row.sbd || '-'}</td>
                        <td className="py-2 px-3 font-medium">{row.fullName}</td>
                        <td className="py-2 px-3">{row.dateOfBirth || '-'}</td>
                        <td className="py-2 px-3 font-mono">{row.code || '-'}</td>
                        <td className="py-2 px-3 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-100/50"
                            onClick={() => handleDeleteUnmatched(row.unmatchedKey || '', idx)}
                            title="Xóa bản ghi không tồn tại"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

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

        {/* Các thẻ thống kê nhanh theo thời gian thực (Giá trị sẽ thay đổi dựa vào Bộ lọc tìm kiếm) */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          <StatCard label="Tổng HV đã lọc" value={stats.total} color="from-blue-500 to-cyan-500" />
          <StatCard label="Đậu" value={stats.passed} color="from-emerald-500 to-teal-500" />
          <StatCard label="Rớt" value={stats.failed} color="from-red-500 to-orange-500" />
          <StatCard label="Chưa thi" value={stats.notTested} color="from-amber-500 to-yellow-500" />
          <StatCard label="Có hồ sơ" value={stats.hasProfile} color="from-purple-500 to-pink-500" />
          <StatCard label="Đã nhận GPLX" value={stats.returnedGPLX} color="from-indigo-500 to-violet-500" />
        </div>

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
                <p className="text-muted-foreground">{isLoading ? 'Đang tải dữ liệu...' : 'Không tìm thấy học viên nào phù hợp'}</p>
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
                      <th className="py-3 px-4 font-semibold">Nơi cư trú</th>
                      <th className="py-3 px-4 font-semibold">Mã Vận Đơn</th>
                      <th className="text-center py-3 px-4 font-semibold">Hồ sơ</th>
                      <th className="text-center py-3 px-4 font-semibold">Kết quả</th>
                      <th className="text-center py-3 px-4 font-semibold">Đã Nộp Tiền</th>
                      <th className="text-center py-3 px-4 font-semibold">GPLX</th>
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
                        <td className="py-3 px-4 text-sm">{candidate.residence || '-'}</td>
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