'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { 
  QrCode, 
  Search, 
  Calendar, 
  Users, 
  Trash2, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  FileSpreadsheet,
  ExternalLink,
  Plus,
  Eraser
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Candidate } from '@/types/candidate';

interface ScannedCandidate extends Candidate {
  scannedAt: Date;
  scanMethod: 'qr' | 'search';
}

const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1LhWQJVepItW3Ag-vDGsZgmH4rX_TicLtVwD-y696bgk/edit?usp=sharing';

export default function ScannerPage() {
  const [sheetsList, setSheetsList] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [unifiedInput, setUnifiedInput] = useState('');
  const [searchMode, setSearchMode] = useState<'qr' | 'name_sbd'>('qr');
  const [scannedCandidates, setScannedCandidates] = useState<ScannedCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [candidateToDelete, setCandidateToDelete] = useState<ScannedCandidate | null>(null);
  const [deleteType, setDeleteType] = useState<'single' | 'profile' | 'gplx'>('single');
  const qrInputRef = useRef<HTMLInputElement>(null);

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

  // Tự động focus vào ô QR khi load trang
  useEffect(() => {
    qrInputRef.current?.focus();
  }, []);

  // Xử lý khi quét QR hoặc nhập mã hiệu
  const handleQRScan = async (code: string) => {
    if (!code.trim()) return;
    
    setIsSearching(true);
    try {
      const response = await fetch(`/api/scanner/search?code=${encodeURIComponent(code)}&date=${selectedDate}`, {
        method: 'GET',
      });
      const result = await response.json();
      
      if (result.success && result.candidates && result.candidates.length > 0) {
        // Thêm từng thí sinh vào danh sách đã quét (tránh trùng)
        setScannedCandidates(prev => {
          const newCandidates = result.candidates.filter(
            (c: Candidate) => !prev.some(p => p.sbd === c.sbd && p.exam_date === c.exam_date)
          );
          return [
            ...prev,
            ...newCandidates.map(c => ({
              ...c,
              scannedAt: new Date(),
              scanMethod: 'qr' as const,
            }))
          ];
        });
      } else {
        alert(`Không tìm thấy thí sinh với mã hiệu: ${code}`);
      }
    } catch (error) {
      console.error('Error searching:', error);
      alert('Có lỗi xảy ra khi tìm kiếm');
    } finally {
      setIsSearching(false);
    }
    
    // Clear input để quét tiếp
    setUnifiedInput('');
    qrInputRef.current?.focus();
  };

  // Xử lý khi nhấn Enter ở ô QR
  const handleQRKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleQRScan(unifiedInput);
    }
  };

  // Tìm kiếm theo tên hoặc SBD
  const handleSearch = async () => {
    if (!unifiedInput.trim()) return;
    
    setIsSearching(true);
    try {
      const response = await fetch(`/api/scanner/search?query=${encodeURIComponent(unifiedInput)}&date=${selectedDate}&type=name_sbd`, {
        method: 'GET',
      });
      const result = await response.json();
      
      if (result.success && result.candidates && result.candidates.length > 0) {
        setScannedCandidates(prev => {
          const newCandidates = result.candidates.filter(
            (c: Candidate) => !prev.some(p => p.sbd === c.sbd && p.exam_date === c.exam_date)
          );
          return [
            ...prev,
            ...newCandidates.map(c => ({
              ...c,
              scannedAt: new Date(),
              scanMethod: 'search' as const,
            }))
          ];
        });
      } else {
        alert(`Không tìm thấy thí sinh với từ khóa: ${unifiedInput}`);
      }
    } catch (error) {
      console.error('Error searching:', error);
      alert('Có lỗi xảy ra khi tìm kiếm');
    } finally {
      setIsSearching(false);
    }
  };

  // Xóa một thí sinh khỏi danh sách
  const removeCandidate = (candidate: ScannedCandidate) => {
    setScannedCandidates(prev => prev.filter(c => c.sbd !== candidate.sbd || c.exam_date !== candidate.exam_date));
  };

  // Xóa toàn bộ danh sách
  const clearAll = () => {
    setScannedCandidates([]);
  };

  // Mở dialog xóa
  const openDeleteDialog = (type: 'single' | 'profile' | 'gplx', candidate?: ScannedCandidate) => {
    setDeleteType(type);
    setCandidateToDelete(candidate || null);
    setShowDeleteDialog(true);
  };

  // Xử lý xóa sau khi xác nhận
  const handleDeleteConfirm = async () => {
    setShowDeleteDialog(false);
    
    if (deleteType === 'single' && candidateToDelete) {
      removeCandidate(candidateToDelete);
      return;
    }

    // Xác định danh sách cần xóa
    let candidatesToDelete: ScannedCandidate[] = [];
    
    if (deleteType === 'profile') {
      candidatesToDelete = scannedCandidates.filter(c => c.has_profile);
    } else if (deleteType === 'gplx') {
      candidatesToDelete = scannedCandidates.filter(c => c.gplx_status === 'Returned');
    }

    if (candidatesToDelete.length === 0) {
      alert('Không có thí sinh nào phù hợp để xóa');
      return;
    }

    try {
      const response = await fetch('/api/scanner/delete-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidates: candidatesToDelete.map(c => ({
            sbd: c.sbd,
            exam_date: c.exam_date,
          })),
          deleteType,
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        // Cập nhật lại danh sách sau khi xóa
        setScannedCandidates(prev => 
          prev.filter(c => !candidatesToDelete.some(d => d.sbd === c.sbd && d.exam_date === c.exam_date))
        );
        alert(`Đã xóa thành công ${result.updatedCount} thí sinh`);
      } else {
        alert('Có lỗi xảy ra khi xóa: ' + result.error);
      }
    } catch (error) {
      console.error('Error deleting:', error);
      alert('Có lỗi xảy ra khi xóa');
    }
    
    setCandidateToDelete(null);
  };

  // Thống kê
  const stats = {
    total: scannedCandidates.length,
    hasProfile: scannedCandidates.filter(c => c.has_profile).length,
    passed: scannedCandidates.filter(c => c.exam_status === 'Pass').length,
    returnedGPLX: scannedCandidates.filter(c => c.gplx_status === 'Returned').length,
  };

  return (
    <>
      <Header
        title="Quét Mã Hiệu & Tìm Kiếm"
        subtitle="Quét QR code, tìm kiếm theo tên/SBD và quản lý hồ sơ"
      />

      <div className="p-4 lg:p-8 space-y-6">
        {/* Controls */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {/* Chọn ngày thi */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Lọc theo ngày thi
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedDate} onValueChange={setSelectedDate}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn ngày thi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toàn Bộ</SelectItem>
                  {sheetsList.map((sheet) => (
                    <SelectItem key={sheet} value={sheet}>
                      📅 {sheet}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Tìm kiếm thống nhất: Quét QR / Mã hiệu / Tên / SBD */}
          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <QrCode className="h-4 w-4" />
                Quét mã hiệu / Tìm tên hoặc SBD
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  ref={qrInputRef}
                  placeholder="Quét QR, nhập mã hiệu, tên hoặc SBD..."
                  value={unifiedInput}
                  onChange={(e) => setUnifiedInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (searchMode === 'qr') {
                        handleQRScan(unifiedInput);
                      } else {
                        handleSearch();
                      }
                    }
                  }}
                  disabled={isSearching}
                />
                <Select value={searchMode} onValueChange={setSearchMode}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Chế độ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="qr">
                      <span className="flex items-center gap-2">
                        <QrCode className="h-4 w-4" />
                        Quét mã
                      </span>
                    </SelectItem>
                    <SelectItem value="name_sbd">
                      <span className="flex items-center gap-2">
                        <Search className="h-4 w-4" />
                        Tìm tên/SBD
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  onClick={() => {
                    if (searchMode === 'qr') {
                      handleQRScan(unifiedInput);
                    } else {
                      handleSearch();
                    }
                  }} 
                  disabled={isSearching || !unifiedInput.trim()}
                >
                  {isSearching ? '⏳' : searchMode === 'qr' ? <QrCode className="h-4 w-4" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {searchMode === 'qr' 
                  ? 'Nhấn Enter sau khi quét QR hoặc nhập mã hiệu' 
                  : 'Nhấn Enter để tìm kiếm theo tên hoặc SBD'}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Google Sheets Link */}
        <Card>
          <CardContent className="pt-4">
            <a
              href={GOOGLE_SHEET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-green-600 hover:underline"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Mở Google Sheets
              <ExternalLink className="h-3 w-3" />
            </a>
          </CardContent>
        </Card>

        {/* Thống kê nhanh */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <StatCard label="Đã quét" value={stats.total} color="from-blue-500 to-cyan-500" />
          <StatCard label="Có hồ sơ" value={stats.hasProfile} color="from-purple-500 to-pink-500" />
          <StatCard label="Đậu" value={stats.passed} color="from-emerald-500 to-teal-500" />
          <StatCard label="Đã nhận GPLX" value={stats.returnedGPLX} color="from-indigo-500 to-violet-500" />
        </motion.div>

        {/* Danh sách đã quét */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Danh sách đã quét ({scannedCandidates.length})
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearAll}
                    disabled={scannedCandidates.length === 0}
                  >
                    <Eraser className="h-4 w-4 mr-1" />
                    Xóa tất cả
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {scannedCandidates.length === 0 ? (
                <div className="text-center py-12">
                  <QrCode className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Chưa có thí sinh nào được quét</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Quét QR code hoặc tìm kiếm theo tên/SBD để thêm
                  </p>
                </div>
              ) : (
                <>
                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => openDeleteDialog('profile')}
                      disabled={stats.hasProfile === 0}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Xóa Hồ Sơ ({stats.hasProfile})
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => openDeleteDialog('gplx')}
                      disabled={stats.returnedGPLX === 0}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Xóa Trạng Thái GPLX ({stats.returnedGPLX})
                    </Button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-semibold">SBD</th>
                          <th className="text-left py-3 px-4 font-semibold">Họ tên</th>
                          <th className="text-left py-3 px-4 font-semibold">Ngày thi</th>
                          <th className="text-center py-3 px-4 font-semibold">Hồ sơ</th>
                          <th className="text-center py-3 px-4 font-semibold">Kết quả</th>
                          <th className="text-center py-3 px-4 font-semibold">GPLX</th>
                          <th className="text-center py-3 px-4 font-semibold">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scannedCandidates.map((candidate) => (
                          <tr key={`${candidate.sbd}-${candidate.exam_date}`} className="border-b hover:bg-muted/50">
                            <td className="py-3 px-4 font-mono text-sm">{candidate.sbd}</td>
                            <td className="py-3 px-4 font-medium">{candidate.name}</td>
                            <td className="py-3 px-4 text-sm">{candidate.exam_date}</td>
                            <td className="text-center py-3 px-4">
                              <Badge variant={candidate.has_profile ? 'default' : 'secondary'}>
                                {candidate.has_profile ? '✓' : '✗'}
                              </Badge>
                            </td>
                            <td className="text-center py-3 px-4">
                              <StatusBadge status={candidate.exam_status} />
                            </td>
                            <td className="text-center py-3 px-4">
                              <Badge variant={candidate.gplx_status === 'Returned' ? 'default' : 'secondary'}>
                                {candidate.gplx_status === 'Returned' ? 'Đã về' : 'Chờ'}
                              </Badge>
                            </td>
                            <td className="text-center py-3 px-4">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDeleteDialog('single', candidate)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Xác nhận xóa
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteType === 'single' ? (
                <>
                  Bạn có chắc chắn muốn xóa thí sinh{' '}
                  <strong>{candidateToDelete?.name}</strong> (SBD: {candidateToDelete?.sbd}) 
                  khỏi danh sách đã quét?
                </>
              ) : deleteType === 'profile' ? (
                <>
                  Bạn có chắc chắn muốn xóa <strong>{stats.hasProfile}</strong> thí sinh có hồ sơ 
                  khỏi danh sách đã quét? Thao tác này sẽ xóa trạng thái "Có hồ sơ" của các thí sinh này.
                </>
              ) : (
                <>
                  Bạn có chắc chắn muốn xóa <strong>{stats.returnedGPLX}</strong> thí sinh đã nhận GPLX 
                  khỏi danh sách đã quét? Thao tác này sẽ xóa trạng thái "Đã về" của các thí sinh này.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">
              <Trash2 className="h-4 w-4 mr-1" />
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
