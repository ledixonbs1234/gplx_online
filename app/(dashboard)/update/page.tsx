// plx_online/app/(dashboard)/update/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Search, RefreshCw, CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface Candidate {
  sbd: string;
  name: string;
  date_of_birth?: string;
  phone?: string;
  residence?: string;
  receive_location?: string;
  exam_date: string;
}

export default function DirectUpdatePage() {
  const [sheetsList, setSheetsList] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form State (Bên trái)
  const [mSbd, setMSbd] = useState('');
  const [mHoTen, setMHoTen] = useState('');
  const [mNgaySinh, setMNgaySinh] = useState('');
  const [mSdt, setMSdt] = useState('');
  const [mDiaChi, setMDiaChi] = useState('');

  // Trạng thái tìm kiếm: 'idle' (chưa tìm), 'found' (tìm thấy), 'not_found' (không tìm thấy)
  const [searchStatus, setSearchStatus] = useState<'idle' | 'found' | 'not_found'>('idle');

  // Danh sách thí sinh vừa cập nhật xong trong phiên làm việc này (Bên phải)
  const [recentlyUpdated, setRecentlyUpdated] = useState<Candidate[]>([]);

  // Thông báo kết quả lưu nhanh
  const [message, setMessage] = useState<{ type: 'success' | 'error' | null; content: string }>({ type: null, content: '' });

  // Tải danh sách ngày thi và khôi phục trạng thái ngày chọn trước đó từ localStorage
  useEffect(() => {
    const loadSheets = async () => {
      try {
        const response = await fetch('/api/sheets/sync?type=list');
        const result = await response.json();
        if (result.success && result.sheets && result.sheets.length > 0) {
          setSheetsList(result.sheets);
          
          // Kiểm tra xem có lưu ngày làm việc trước đó trong localStorage không
          const savedDate = localStorage.getItem('gplx_selected_update_date');
          if (savedDate && result.sheets.includes(savedDate)) {
            setSelectedDate(savedDate);
          } else {
            setSelectedDate(result.sheets[0]); // Nếu không có thì chọn ngày mới nhất
          }
        }
      } catch (error) {
        console.error('Error loading sheets:', error);
      }
    };
    loadSheets();
  }, []);

  // Tải danh sách học viên theo ngày thi đã chọn để phục vụ tra cứu nhanh
  useEffect(() => {
    if (!selectedDate) return;

    const loadCandidates = async () => {
      setIsLoading(true);
      setCandidates([]);
      handleResetForm();
      try {
        const response = await fetch(`/api/sheets/data?date=${selectedDate}`);
        const result = await response.json();
        if (result.success) {
          setCandidates(result.candidates || []);
        }
      } catch (error) {
        console.error('Error loading candidates:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCandidates();
  }, [selectedDate]);

  // Reset form về mặc định
  const handleResetForm = () => {
    setMSbd('');
    setMHoTen('');
    setMNgaySinh('');
    setMSdt('');
    setMDiaChi('');
    setSearchStatus('idle');
    setMessage({ type: null, content: '' });
  };

  // Thay đổi ngày thi chủ động và lưu vào localStorage
  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    localStorage.setItem('gplx_selected_update_date', date);
  };

  // Tra cứu Số báo danh chính xác (===)
  const handleLookup = () => {
    if (!mSbd.trim()) return;

    const targetSbd = mSbd.trim().toLowerCase();
    
    // Tìm kiếm đối chiếu chính xác tuyệt đối
    const found = candidates.find(c => c.sbd.trim().toLowerCase() === targetSbd);

    if (found) {
      setMHoTen(found.name);
      setMNgaySinh(found.date_of_birth || '');
      setMSdt(found.phone || '');
      setMDiaChi(found.residence || found.receive_location || '');
      setSearchStatus('found');
      setMessage({ type: null, content: '' });
    } else {
      setMHoTen('Không tìm thấy hoặc đã cập nhật');
      setMNgaySinh('');
      setSearchStatus('not_found');
    }
  };

  // Xử lý lưu thông tin trực tiếp
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (searchStatus !== 'found' || !mSbd.trim()) {
      setMessage({ type: 'error', content: 'Vui lòng nhập SBD hợp lệ và nhấn TÌM trước.' });
      return;
    }

    if (!mSdt.trim() || !mDiaChi.trim()) {
      setMessage({ type: 'error', content: 'Vui lòng nhập đầy đủ Số điện thoại và Địa chỉ bưu điện.' });
      return;
    }

    setIsSaving(true);
    setMessage({ type: null, content: '' });

    try {
      const response = await fetch('/api/sheets/update-candidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examDate: selectedDate,
          sbd: mSbd.trim(),
          phone: mSdt.trim(),
          residence: mDiaChi.trim()
        }),
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ type: 'success', content: 'Cập nhật thông tin bưu điện thành công!' });

        // Cập nhật mảng tạm thời ở Client
        setCandidates(prev => prev.map(c => {
          if (c.sbd.trim().toLowerCase() === mSbd.trim().toLowerCase()) {
            return { ...c, phone: mSdt, residence: mDiaChi };
          }
          return c;
        }));

        // Đẩy thí sinh lên đầu danh sách nhật ký phiên làm việc
        const updatedCandidate: Candidate = {
          sbd: mSbd.trim(),
          name: mHoTen,
          date_of_birth: mNgaySinh,
          phone: mSdt.trim(),
          residence: mDiaChi.trim(),
          exam_date: selectedDate
        };

        setRecentlyUpdated(prev => {
          const filtered = prev.filter(item => item.sbd.trim().toLowerCase() !== mSbd.trim().toLowerCase());
          return [updatedCandidate, ...filtered];
        });

        // Xóa form sau khi lưu thành công để chuẩn bị nhập tiếp
        setTimeout(() => {
          handleResetForm();
        }, 1500);

      } else {
        setMessage({ type: 'error', content: result.error || 'Có lỗi xảy ra khi lưu dữ liệu.' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', content: error.message || 'Lỗi kết nối hệ thống.' });
    } finally {
      setIsSaving(false);
    }
  };

  // Điền ngược thông tin khi bấm vào cột lịch sử bên phải
  const handleSelectRecent = (candidate: Candidate) => {
    setMSbd(candidate.sbd);
    setMHoTen(candidate.name);
    setMNgaySinh(candidate.date_of_birth || '');
    setMSdt(candidate.phone || '');
    setMDiaChi(candidate.residence || '');
    setSearchStatus('found');
    setMessage({ type: null, content: '' });
  };

  return (
    <>
      <Header
        title="Nhập Liệu Trực Tiếp"
        subtitle="Hệ thống cập nhật thông tin nhận GPLX qua điện thoại và bưu điện"
      />

      <div className="p-4 lg:p-8 space-y-6">
        {/* Bộ lọc ngày thi chủ động */}
        <Card className="glass">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex items-center gap-2 text-sm font-semibold whitespace-nowrap">
                <Calendar className="h-5 w-5 text-primary animate-pulse" />
                <span>Thao tác trên ngày thi:</span>
              </div>
              <Select value={selectedDate} onValueChange={handleDateChange}>
                <SelectTrigger className="w-full sm:w-[240px] glass">
                  <SelectValue placeholder="Chọn ngày thi" />
                </SelectTrigger>
                <SelectContent>
                  {sheetsList.map((sheet) => (
                    <SelectItem key={sheet} value={sheet}>
                      📅 Ngày: {sheet}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isLoading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span>Đang tải thông tin học viên...</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Cấu trúc Master - Detail hai cột */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* PHẦN TRÁI: Form nhập liệu cỡ lớn */}
          <div className="lg:col-span-6">
            <Card className="glass border-primary/20 shadow-xl">
              <CardContent className="pt-6 space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-emerald-700">Nhập liệu thủ công</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Dành cho trường hợp nhận thông tin qua điện thoại / tin nhắn.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Số báo danh - Sử dụng thẻ input thuần cùng style cưỡng chế cỡ chữ lớn */}
                  <div className="space-y-2">
                    <label className="text-base font-bold text-neutral-800 dark:text-neutral-200">Số Báo Danh</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={mSbd}
                        onChange={(e) => setMSbd(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleLookup();
                          }
                        }}
                        placeholder="Nhập SBD..."
                        className="flex-1 w-full rounded-lg border border-input bg-transparent px-4 h-16 uppercase tracking-wide outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors uppercase"
                        style={{ fontSize: '28px', fontWeight: '800' }}
                      />
                      <Button
                        type="button"
                        onClick={handleLookup}
                        disabled={isLoading || !mSbd.trim()}
                        className="h-16 px-8 bg-[#2e7d32] hover:bg-[#1b5e20] text-white shrink-0 rounded-lg shadow-md transition-all"
                        style={{ fontSize: '20px', fontWeight: '950' }}
                      >
                        TÌM
                      </Button>
                    </div>
                  </div>

                  {/* Khối hiển thị thông tin học viên tìm kiếm */}
                  <div className="bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-100 dark:border-neutral-800/80 rounded-xl p-5 min-h-[140px] flex flex-col justify-center">
                    {searchStatus === 'idle' ? (
                      <div className="text-center text-sm text-muted-foreground">
                        Nhập SBD học viên và nhấn <strong className="text-primary">TÌM</strong> để hiển thị thông tin đối chiếu.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <span className="text-xs text-muted-foreground font-semibold uppercase block">Họ Tên:</span>
                          <span className={`block font-extrabold leading-tight mt-1 ${
                            searchStatus === 'not_found' 
                              ? 'text-red-500 text-2xl' 
                              : 'text-neutral-800 dark:text-neutral-100 text-3.5xl'
                          }`} style={{ fontSize: '32px' }}>
                            {mHoTen}
                          </span>
                        </div>
                        {searchStatus === 'found' && (
                          <div>
                            <span className="text-xs text-muted-foreground font-semibold uppercase block">Ngày Sinh:</span>
                            <span className="text-xl font-bold text-neutral-700 dark:text-neutral-300 mt-1 block" style={{ fontSize: '22px' }}>
                              {mNgaySinh || 'Chưa ghi nhận'}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Số điện thoại - Sử dụng thẻ input thuần cùng style cưỡng chế cỡ chữ cực đại 38px */}
                  <div className="space-y-2">
                    <label className="text-base font-bold text-neutral-800 dark:text-neutral-200">Số Điện Thoại</label>
                    <input
                      type="tel"
                      value={mSdt}
                      onChange={(e) => setMSdt(e.target.value)}
                      placeholder="Nhập SĐT..."
                      className="w-full rounded-lg border border-input bg-transparent px-5 h-20 text-[#2e7d32] tracking-widest outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ fontSize: '38px', fontWeight: '950' }}
                      disabled={searchStatus !== 'found'}
                    />
                  </div>

                  {/* Địa chỉ nhận bưu điện - Sử dụng thẻ input thuần cùng style cưỡng chế cỡ chữ lớn 24px */}
                  <div className="space-y-2">
                    <label className="text-base font-bold text-neutral-800 dark:text-neutral-200">Địa chỉ nhận (qua bưu điện)</label>
                    <input
                      type="text"
                      value={mDiaChi}
                      onChange={(e) => setMDiaChi(e.target.value)}
                      placeholder="Nhập địa chỉ nhận..."
                      className="w-full rounded-lg border border-input bg-transparent px-4 h-16 outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                      style={{ fontSize: '24px' }}
                      disabled={searchStatus !== 'found'}
                    />
                  </div>

                  {/* Trạng thái thông báo lưu dữ liệu */}
                  {message.content && (
                    <div className={`p-4 rounded-xl flex items-center gap-2 text-sm ${
                      message.type === 'success'
                        ? 'bg-green-500/10 text-green-600 border border-green-500/20'
                        : 'bg-red-500/10 text-red-600 border border-red-500/20'
                    }`}>
                      {message.type === 'success' ? (
                        <CheckCircle className="h-5 w-5 shrink-0" />
                      ) : (
                        <AlertCircle className="h-5 w-5 shrink-0" />
                      )}
                      <span className="font-medium">{message.content}</span>
                    </div>
                  )}

                  {/* Nút gửi dữ liệu cập nhật */}
                  <Button
                    type="submit"
                    disabled={isSaving || searchStatus !== 'found'}
                    className="w-full h-16 bg-[#2e7d32] hover:bg-[#1b5e20] text-white font-black text-xl rounded-xl shadow-lg transition-transform hover:scale-[1.01]"
                  >
                    {isSaving ? (
                      <span className="flex items-center gap-2">
                        <RefreshCw className="h-5 w-5 animate-spin" />
                        ĐANG TIẾN HÀNH LƯU...
                      </span>
                    ) : (
                      'CẬP NHẬT TRỰC TIẾP'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* PHẦN PHẢI: Lịch sử học viên vừa cập nhật trong phiên */}
          <div className="lg:col-span-6 space-y-4">
            <Card className="glass h-[calc(100vh-280px)] flex flex-col overflow-hidden border-indigo-500/20 shadow-lg">
              <CardHeader className="pb-3 border-b border-muted">
                <CardTitle className="text-lg font-bold flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-indigo-500" />
                    Thí sinh vừa cập nhật xong
                  </span>
                  <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-600 font-bold">
                    {recentlyUpdated.length} bản ghi
                  </Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Danh sách những người vừa lưu thành công. Chọn bất kỳ ai để sửa lại nhanh.
                </p>
              </CardHeader>

              <CardContent className="flex-1 overflow-y-auto space-y-3 p-4 pr-2 no-scrollbar">
                {recentlyUpdated.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm py-12">
                    <Clock className="h-12 w-12 text-muted-foreground/30 mb-2 animate-pulse" />
                    <span>Chưa có thí sinh nào được cập nhật trong phiên này.</span>
                  </div>
                ) : (
                  recentlyUpdated.map((item) => (
                    <motion.div
                      key={item.sbd}
                      whileHover={{ scale: 1.01 }}
                      onClick={() => handleSelectRecent(item)}
                      className="p-4 rounded-xl border border-indigo-500/10 bg-card/40 hover:bg-indigo-500/5 cursor-pointer transition-all space-y-2 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-extrabold px-2 py-1 rounded bg-indigo-500/10 text-indigo-600">
                          SBD: {item.sbd}
                        </span>
                        <span className="text-[10px] text-muted-foreground">Vừa cập nhật xong</span>
                      </div>
                      <h4 className="font-bold text-base text-foreground">{item.name}</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 border-t border-muted text-xs text-muted-foreground">
                        <div>📞 SĐT: <strong className="text-foreground">{item.phone}</strong></div>
                        <div className="truncate">📍 Địa chỉ: <strong className="text-foreground">{item.residence}</strong></div>
                      </div>
                    </motion.div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </>
  );
}