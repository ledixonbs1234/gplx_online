// plx_online/app/(dashboard)/scanner/page.tsx
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
  Eraser,
  Camera,
  Smartphone
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Candidate } from '@/types/candidate';

interface ScannedCandidate extends Candidate {
  scannedAt: Date;
  scanMethod: 'qr' | 'search';
}

const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1LhWQJVepItW3Ag-vDGsZgmH4rX_TicLtVwD-y696bgk/edit?usp=sharing';

const triggerSuccessFeedback = () => {
  if (typeof window === 'undefined') return;

  if ('vibrate' in navigator) {
    navigator.vibrate(200);
  }

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      const audioCtx = new AudioContextClass();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.value = 1200;
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1);
    }
  } catch (error) {
    console.warn('Thiết bị hoặc trình duyệt không cho phép phát âm thanh:', error);
  }
};

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
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const qrInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // States cho Hộp thoại Rút bưu gửi
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [withdrawCandidate, setWithdrawCandidate] = useState<ScannedCandidate | null>(null);
  const [wHasProfile, setWHasProfile] = useState(false);
  const [wExamStatus, setWExamStatus] = useState<'Pass' | 'Fail' | 'Not_Tested'>('Pass');
  const [wHasAppAndFee, setWHasAppAndFee] = useState(false);
  const [wGplxStatus, setWGplxStatus] = useState<'Returned' | 'Pending'>('Pending');

  const scannedCandidatesRef = useRef(scannedCandidates);
  const selectedDateRef = useRef(selectedDate);
  const lastScannedCodeRef = useRef<string | null>(null);
  const lastScannedTimeRef = useRef<number>(0);
  const isProcessingRef = useRef<boolean>(false);

  useEffect(() => {
    scannedCandidatesRef.current = scannedCandidates;
  }, [scannedCandidates]);

  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  useEffect(() => {
    if (!showCameraScanner) {
      lastScannedCodeRef.current = null;
      lastScannedTimeRef.current = 0;
      isProcessingRef.current = false;
    }
  }, [showCameraScanner]);

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

  useEffect(() => {
    qrInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowCameraScanner(false);
      }
    };

    if (showCameraScanner) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showCameraScanner]);

  useEffect(() => {
    if (showCameraScanner && typeof window !== 'undefined') {
      const initScanner = async () => {
        try {
          const { Html5Qrcode } = await import('html5-qrcode');
          const html5QrCode = new Html5Qrcode('qr-reader');
          const config = { fps: 10, qrbox: { width: 250, height: 250 } };

          html5QrCode.start(
            { facingMode: 'environment' },
            config,
            (decodedText) => {
              handleCameraScanResult(decodedText);
            },
            (error) => {
              console.log('Scan error:', error);
            }
          ).catch((err) => {
            console.error('Unable to start scanning', err);
          });

          (window as any).qrCodeScanner = html5QrCode;
        } catch (error) {
          console.error('Failed to load QR scanner:', error);
        }
      };

      initScanner();
    }

    return () => {
      if ((window as any).qrCodeScanner) {
        (window as any).qrCodeScanner.stop().catch(console.error);
        (window as any).qrCodeScanner = null;
      }
    };
  }, [showCameraScanner]);

  const handleCameraScanResult = (code: string) => {
    if (!code.trim()) return;

    const extractedCode = code.trim();
    const now = Date.now();

    if (lastScannedCodeRef.current === extractedCode && now - lastScannedTimeRef.current < 3000) {
      return;
    }

    if (isProcessingRef.current) {
      return;
    }

    lastScannedCodeRef.current = extractedCode;
    lastScannedTimeRef.current = now;

    const isDuplicate = scannedCandidatesRef.current.some(c => c.sbd === extractedCode);

    if (isDuplicate) {
      console.log('Mã hiệu đã có trong danh sách đã quét (trùng lặp):', extractedCode);
      return;
    }

    performQRScan(extractedCode, true);
  };

  const performQRScan = async (code: string, fromCamera: boolean = false) => {
    if (!code.trim()) return;

    setIsSearching(true);
    if (fromCamera) {
      isProcessingRef.current = true;
    }

    try {
      const currentDate = selectedDateRef.current;
      const response = await fetch(`/api/scanner/search?code=${encodeURIComponent(code)}&date=${currentDate}`, {
        method: 'GET',
      });
      const result = await response.json();

      if (result.success && result.candidates && result.candidates.length > 0) {
        const currentScanned = scannedCandidatesRef.current;
        const hasNewCandidates = result.candidates.some(
          (c: Candidate) => !currentScanned.some(p => p.sbd === c.sbd && p.exam_date === c.exam_date)
        );

        if (hasNewCandidates) {
          triggerSuccessFeedback();
        }

        setScannedCandidates(prev => {
          const newCandidates = result.candidates.filter(
            (c: Candidate) => !prev.some(p => p.sbd === c.sbd && p.exam_date === c.exam_date)
          );
          return [
            ...prev,
            ...newCandidates.map((c: any) => ({
              ...c,
              scannedAt: new Date(),
              scanMethod: 'qr',
            }))
          ];
        });
      } else {
        if (!fromCamera) {
          alert(`Không tìm thấy thí sinh với mã hiệu: ${code}`);
        }
      }
    } catch (error) {
      console.error('Error searching:', error);
      if (!fromCamera) {
        alert('Có lỗi xảy ra khi tìm kiếm');
      }
    } finally {
      setIsSearching(false);
      if (fromCamera) {
        isProcessingRef.current = false;
      }
    }

    if (!fromCamera) {
      setUnifiedInput('');
      qrInputRef.current?.focus();
    }
  };

  const handleSearch = async () => {
    if (!unifiedInput.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(`/api/scanner/search?query=${encodeURIComponent(unifiedInput)}&date=${selectedDate}&type=name_sbd`, {
        method: 'GET',
      });
      const result = await response.json();

      if (result.success && result.candidates && result.candidates.length > 0) {
        const hasNewCandidates = result.candidates.some(
          (c: Candidate) => !scannedCandidates.some(p => p.sbd === c.sbd && p.exam_date === c.exam_date)
        );

        if (hasNewCandidates) {
          triggerSuccessFeedback();
        }

        setScannedCandidates(prev => {
          const newCandidates = result.candidates.filter(
            (c: Candidate) => !prev.some(p => p.sbd === c.sbd && p.exam_date === c.exam_date)
          );
          return [
            ...prev,
            ...newCandidates.map((c: any) => ({
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

  const removeCandidate = (candidate: ScannedCandidate) => {
    setScannedCandidates(prev => prev.filter(c => c.sbd !== candidate.sbd || c.exam_date !== candidate.exam_date));
  };

  const clearAll = () => {
    setScannedCandidates([]);
  };

  const openDeleteDialog = (type: 'single' | 'profile' | 'gplx', candidate?: ScannedCandidate) => {
    setDeleteType(type);
    setCandidateToDelete(candidate || null);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    setShowDeleteDialog(false);

    if (deleteType === 'single' && candidateToDelete) {
      removeCandidate(candidateToDelete);
      return;
    }

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

  // Mở hộp thoại cấu hình rút bưu gửi
  const handleOpenWithdraw = (candidate: ScannedCandidate) => {
    setWithdrawCandidate(candidate);
    setWHasProfile(candidate.has_profile);
    setWExamStatus(candidate.exam_status);
    setWHasAppAndFee(candidate.has_app_and_fee);
    setWGplxStatus('Pending'); // Mặc định là Chờ (chưa có gplx) khi rút bưu gửi
    setShowWithdrawDialog(true);
  };

  // Xác nhận rút bưu gửi trực tiếp
  const handleWithdrawConfirm = async () => {
    if (!withdrawCandidate) return;

    setIsSearching(true);
    try {
      const response = await fetch('/api/sheets/withdraw-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examDate: withdrawCandidate.exam_date,
          sbd: withdrawCandidate.sbd,
          trackingNumber: withdrawCandidate.tracking_number,
          hasProfile: wHasProfile,
          examStatus: wExamStatus,
          hasAppAndFee: wHasAppAndFee,
          gplxStatus: wGplxStatus
        }),
      });
      const result = await response.json();
      if (result.success) {
        alert(result.message);
        removeCandidate(withdrawCandidate);
        setShowWithdrawDialog(false);
        setWithdrawCandidate(null);
      } else {
        alert(`Lỗi: ${result.error}`);
      }
    } catch (error) {
      console.error(error);
      alert('Không thể thực hiện rút bưu gửi.');
    } finally {
      setIsSearching(false);
    }
  };

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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
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

          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <QrCode className="h-4 w-4" />
                Quét mã hiệu / Tìm tên hoặc SBD
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  ref={qrInputRef}
                  placeholder="Quét QR, nhập mã hiệu, tên hoặc SBD..."
                  value={unifiedInput}
                  onChange={(e) => setUnifiedInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (searchMode === 'qr') {
                        performQRScan(unifiedInput, false);
                      } else {
                        handleSearch();
                      }
                    }
                  }}
                  disabled={isSearching}
                  className="flex-1"
                />
                <div className="flex gap-2">
                  <Select value={searchMode} onValueChange={(value) => setSearchMode(value as 'qr' | 'name_sbd')}>
                    <SelectTrigger className="w-full sm:w-[140px]">
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
                        performQRScan(unifiedInput, false);
                      } else {
                        handleSearch();
                      }
                    }}
                    disabled={isSearching || !unifiedInput.trim()}
                    size="icon"
                    className="shrink-0"
                  >
                    {isSearching ? '⏳' : searchMode === 'qr' ? <QrCode className="h-4 w-4" /> : <Search className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowCameraScanner(true)}
                    className="shrink-0 sm:hidden"
                    title="Mở camera quét QR"
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {searchMode === 'qr'
                  ? 'Nhấn Enter sau khi quét QR hoặc nhập mã hiệu'
                  : 'Nhấn Enter để tìm kiếm theo tên hoặc SBD'}
              </p>
            </CardContent>
          </Card>
        </motion.div>

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

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
        >
          <StatCard label="Đã quét" value={stats.total} color="from-blue-500 to-cyan-500" />
          <StatCard label="Có hồ sơ" value={stats.hasProfile} color="from-purple-500 to-pink-500" />
          <StatCard label="Đậu" value={stats.passed} color="from-emerald-500 to-teal-500" />
          <StatCard label="Đã nhận GPLX" value={stats.returnedGPLX} color="from-indigo-500 to-violet-500" />
        </motion.div>

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
                        <tr className="border-b text-left">
                          <th className="py-3 px-2 sm:px-4 font-semibold text-xs sm:text-sm whitespace-nowrap">SBD</th>
                          <th className="py-3 px-2 sm:px-4 font-semibold text-xs sm:text-sm whitespace-nowrap">Họ tên</th>
                          <th className="py-3 px-2 sm:px-4 font-semibold text-xs sm:text-sm whitespace-nowrap hidden sm:table-cell">Ngày thi</th>
                          <th className="text-center py-3 px-2 sm:px-4 font-semibold text-xs sm:text-sm whitespace-nowrap">Hồ sơ</th>
                          <th className="text-center py-3 px-2 sm:px-4 font-semibold text-xs sm:text-sm whitespace-nowrap">Kết quả</th>
                          <th className="text-center py-3 px-2 sm:px-4 font-semibold text-xs sm:text-sm whitespace-nowrap hidden md:table-cell">GPLX</th>
                          <th className="text-center py-3 px-2 sm:px-4 font-semibold text-xs sm:text-sm whitespace-nowrap">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scannedCandidates.map((candidate) => (
                          <tr key={`${candidate.sbd}-${candidate.exam_date}`} className="border-b hover:bg-muted/50">
                            <td className="py-3 px-2 sm:px-4 font-mono text-xs sm:text-sm">{candidate.sbd}</td>
                            <td className="py-3 px-2 sm:px-4 font-medium text-xs sm:text-sm">{candidate.name}</td>
                            <td className="py-3 px-2 sm:px-4 text-xs sm:text-sm hidden sm:table-cell">{candidate.exam_date}</td>
                            <td className="text-center py-3 px-2 sm:px-4">
                              <Badge variant={candidate.has_profile ? 'default' : 'secondary'}>
                                {candidate.has_profile ? 'Có' : 'Không'}
                              </Badge>
                            </td>
                            <td className="text-center py-3 px-2 sm:px-4">
                              <StatusBadge status={candidate.exam_status} />
                            </td>
                            <td className="text-center py-3 px-2 sm:px-4 hidden md:table-cell">
                              <Badge variant={candidate.gplx_status === 'Returned' ? 'default' : 'secondary'}>
                                {candidate.gplx_status === 'Returned' ? 'Đã về' : 'Chờ'}
                              </Badge>
                            </td>
                            <td className="text-center py-3 px-2 sm:px-4 flex justify-center gap-1.5">
                              {candidate.tracking_number && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold"
                                  onClick={() => handleOpenWithdraw(candidate)}
                                  title="Rút bưu gửi & Điều chỉnh trạng thái"
                                >
                                  Rút bưu
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
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

      {/* Withdraw State Dialog (Cấu hình khi rút bưu) */}
      {showWithdrawDialog && withdrawCandidate && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-in fade-in" onClick={() => setShowWithdrawDialog(false)}>
          <div className="bg-background rounded-lg w-full max-w-md p-6 border shadow-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg text-amber-700 flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              Rút bưu gửi & Điều chỉnh trạng thái
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Bạn đang tiến hành rút bưu gửi có mã vận đơn <code className="bg-muted px-1 rounded font-mono font-bold text-amber-800">{withdrawCandidate.tracking_number}</code> của học viên <strong>{withdrawCandidate.name}</strong> (SBD: {withdrawCandidate.sbd}). Vui lòng điều chỉnh các thông tin cập nhật lên bảng tính:
            </p>

            <div className="space-y-4">
              {/* 1. Hồ sơ */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">Trạng thái hồ sơ</label>
                <Select value={wHasProfile ? 'true' : 'false'} onValueChange={(val) => setWHasProfile(val === 'true')}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Có hồ sơ</SelectItem>
                    <SelectItem value="false">Không có hồ sơ (Chưa hồ sơ)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 2. GPLX */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">Trạng thái GPLX</label>
                <Select value={wGplxStatus} onValueChange={(val: any) => setWGplxStatus(val)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending">Chờ GPLX (Chưa có GPLX)</SelectItem>
                    <SelectItem value="Returned">Đã về (Có GPLX)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 3. Kết quả thi */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">Kết quả thi (Giữ nguyên hoặc chỉnh)</label>
                <Select value={wExamStatus} onValueChange={(val: any) => setWExamStatus(val)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pass">Đậu</SelectItem>
                    <SelectItem value="Fail">Rớt</SelectItem>
                    <SelectItem value="Not_Tested">Chưa thi</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 4. Đăng ký app & Nộp tiền */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">Đăng ký app / Đóng phí (Giữ nguyên hoặc chỉnh)</label>
                <Select value={wHasAppAndFee ? 'true' : 'false'} onValueChange={(val) => setWHasAppAndFee(val === 'true')}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Đã nộp tiền</SelectItem>
                    <SelectItem value="false">Chưa nộp tiền</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowWithdrawDialog(false)}>
                Hủy
              </Button>
              <Button
                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                onClick={handleWithdrawConfirm}
                disabled={isSearching}
              >
                {isSearching ? 'Đang thực hiện...' : 'Xác nhận Rút bưu'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Xác nhận xóa khỏi danh sách đã quét
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteType === 'single' ? (
                <>
                  Bạn có chắc chắn muốn xóa thí sinh{' '}
                  <strong>{candidateToDelete?.name}</strong> (SBD: {candidateToDelete?.sbd})
                  khỏi danh sách hiển thị đã quét tạm thời?
                </>
              ) : deleteType === 'profile' ? (
                <>
                  Bạn có chắc chắn muốn xóa <strong>{stats.hasProfile}</strong> thí sinh có hồ sơ
                  khỏi danh sách? Thao tác này sẽ cập nhật lại trạng thái "Không có hồ sơ" của họ trên Google Sheets.
                </>
              ) : (
                <>
                  Bạn có chắc chắn muốn xóa <strong>{stats.returnedGPLX}</strong> thí sinh đã nhận GPLX
                  khỏi danh sách? Thao tác này sẽ cập nhật lại trạng thái "Chờ" của họ trên Google Sheets.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">
              <Trash2 className="h-4 w-4 mr-1" />
              Xác nhận xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Camera Scanner Modal for Mobile */}
      {showCameraScanner && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setShowCameraScanner(false)}>
          <div ref={containerRef} className="bg-background rounded-lg w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Quét QR Code
              </h3>
              <Button variant="ghost" size="icon" onClick={() => setShowCameraScanner(false)}>
                <XCircle className="h-5 w-5" />
              </Button>
            </div>
            <div className="p-4">
              <p className="text-sm text-muted-foreground mb-4">
                Sử dụng camera để quét mã QR. Vui lòng cấp quyền truy cập camera khi được yêu cầu.
              </p>
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center mb-4 overflow-hidden">
                <div id="qr-reader" className="w-full"></div>
              </div>
              <p className="text-xs text-center text-muted-foreground">
                Hoặc nhập mã thủ công bên dưới
              </p>
              <div className="flex gap-2 mt-4">
                <Input
                  placeholder="Nhập mã hiệu..."
                  value={unifiedInput}
                  onChange={(e) => setUnifiedInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      performQRScan(unifiedInput, false);
                    }
                  }}
                />
                <Button
                  onClick={() => performQRScan(unifiedInput, false)}
                  disabled={!unifiedInput.trim()}
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-xl bg-gradient-to-br ${color} p-3 sm:p-4 text-white shadow-lg`}>
      <p className="text-xs opacity-90">{label}</p>
      <p className="text-xl sm:text-2xl font-bold">{value}</p>
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
    <Badge className={`${config[status].color} text-white text-xs`}>
      {config[status].label}
    </Badge>
  );
}