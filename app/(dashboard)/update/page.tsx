// plx_online/app/(dashboard)/update/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Search, RefreshCw, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import diachiData from '@/diachi.json'; // Import dữ liệu địa chỉ

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

  // Form State
  const [mSbd, setMSbd] = useState('');
  const [mHoTen, setMHoTen] = useState('');
  const [mNgaySinh, setMNgaySinh] = useState('');
  const [mSdt, setMSdt] = useState('');
  const [mDiaChi, setMDiaChi] = useState('');

  // Trạng thái gợi ý địa chỉ thông minh
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);

  const [searchStatus, setSearchStatus] = useState<'idle' | 'found' | 'not_found'>('idle');
  const [recentlyUpdated, setRecentlyUpdated] = useState<Candidate[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | null; content: string }>({ type: null, content: '' });

  const phoneInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadSheets = async () => {
      try {
        const response = await fetch('/api/sheets/sync?type=list');
        const result = await response.json();
        if (result.success && result.sheets && result.sheets.length > 0) {
          setSheetsList(result.sheets);
          const savedDate = localStorage.getItem('gplx_selected_update_date');
          if (savedDate && result.sheets.includes(savedDate)) {
            setSelectedDate(savedDate);
          } else {
            setSelectedDate(result.sheets[0]);
          }
        }
      } catch (error) {
        console.error('Error loading sheets:', error);
      }
    };
    loadSheets();
  }, []);

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

  const handleResetForm = () => {
    setMSbd('');
    setMHoTen('');
    setMNgaySinh('');
    setMSdt('');
    setMDiaChi('');
    setSuggestions([]);
    setShowSuggestions(false);
    setSearchStatus('idle');
    setMessage({ type: null, content: '' });
  };

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    localStorage.setItem('gplx_selected_update_date', date);
  };

  const handleLookup = () => {
    if (!mSbd.trim()) return;

    const targetSbd = mSbd.trim().toLowerCase();
    const found = candidates.find(c => c.sbd.trim().toLowerCase() === targetSbd);

    if (found) {
      setMHoTen(found.name);
      setMNgaySinh(found.date_of_birth || '');
      setMSdt(found.phone || '');
      setMDiaChi(found.residence || found.receive_location || '');
      setSearchStatus('found');
      setMessage({ type: null, content: '' });

      setTimeout(() => {
        if (phoneInputRef.current) {
          phoneInputRef.current.focus();
          phoneInputRef.current.select();
        }
      }, 50);
    } else {
      setMHoTen('Không tìm thấy hoặc đã cập nhật');
      setMNgaySinh('');
      setSearchStatus('not_found');
    }
  };

  // Thuật toán tách lọc địa chỉ thông minh
  const handleAddressChange = (val: string) => {
    setMDiaChi(val);
    if (!val.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const userInput = val.toLowerCase();
    
    const normalizeStr = (str: string) => {
      return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .trim();
    };
    const normalizedInput = normalizeStr(userInput);

    const matchedList: any[] = [];

    diachiData.forEach((item: any) => {
      const initLower = item.Init.toLowerCase();
      const nLower = item.N.toLowerCase();
      const kdLower = item.KD.toLowerCase();
      const nameLower = item.Name.toLowerCase();

      let matchedTextInInput = '';
      let matchType: 'init' | 'n' | 'kd' | 'name' | 'direct' = 'direct';

      // 1. Kiểm tra phím tắt (Init) ở cuối chuỗi nhập (ví dụ: "25 trần hưng đạo bs", "25 trần hưng đạo, tqb")
      const initRegex = new RegExp(`(?:\\s|,|^)${initLower}$`, 'i');
      const initMatch = userInput.match(initRegex);

      if (initMatch) {
        matchedTextInInput = initMatch[0];
        matchType = 'init';
      }
      // 2. Kiểm tra tên có dấu (N) ở cuối hoặc trong chuỗi nhập
      else if (userInput.includes(nLower)) {
        const idx = userInput.lastIndexOf(nLower);
        matchedTextInInput = val.substring(idx);
        matchType = 'n';
      } 
      // 3. Kiểm tra tên không dấu (KD) trong chuỗi nhập
      else if (normalizedInput.includes(kdLower)) {
        const idx = normalizedInput.lastIndexOf(kdLower);
        matchedTextInInput = val.substring(idx);
        matchType = 'kd';
      } 
      // 4. Kiểm tra tên đầy đủ (Name) trong chuỗi nhập
      else if (userInput.includes(nameLower)) {
        const idx = userInput.lastIndexOf(nameLower);
        matchedTextInInput = val.substring(idx);
        matchType = 'name';
      }
      // 5. Nếu người dùng chỉ gõ đơn thuần tên phường xã để tìm kiếm trực tiếp
      else if (nameLower.includes(userInput) || nLower.includes(userInput) || kdLower.includes(normalizedInput) || initLower.startsWith(userInput)) {
        matchedTextInInput = val;
        matchType = 'direct';
      }

      if (matchedTextInInput) {
        matchedList.push({
          item,
          matchedTextInInput,
          matchType
        });
      }
    });

    setSuggestions(matchedList.slice(0, 5));
    setShowSuggestions(matchedList.length > 0);
    setActiveSuggestionIndex(0);
  };

  // Xác nhận và ghép địa chỉ hoàn chỉnh
  const handleSelectSuggestion = (suggestionData: any) => {
    const { item, matchedTextInInput, matchType } = suggestionData;
    
    let prefix = mDiaChi;
    if (matchType !== 'direct') {
      const idx = mDiaChi.toLowerCase().lastIndexOf(matchedTextInInput.toLowerCase());
      if (idx !== -1) {
        prefix = mDiaChi.substring(0, idx);
      }
    }
    
    // Loại bỏ khoảng trắng và dấu phẩy thừa ở cuối số nhà/tên đường
    prefix = prefix.trim().replace(/[,-\s]+$/, '');
    
    // Viết hoa chữ cái đầu của các từ trong tên đường (vd: "25 trần hưng đạo" -> "25 Trần Hưng Đạo")
    const formattedPrefix = prefix.split(' ').map((word: string) => {
      if (/^\d/.test(word)) return word; // Giữ nguyên số nhà dạng số
      return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');

    const capitalizedWard = item.Name.split(' ')
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    const finalAddress = formattedPrefix 
      ? `${formattedPrefix}, ${capitalizedWard}, Tỉnh Gia Lai`
      : `${capitalizedWard}, Tỉnh Gia Lai`;

    setMDiaChi(finalAddress);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleAddressKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveSuggestionIndex((prev) => (prev + 1) % suggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveSuggestionIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSelectSuggestion(suggestions[activeSuggestionIndex]);
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    }
  };

  const handleAddressBlur = () => {
    setTimeout(() => {
      setShowSuggestions(false);
    }, 200);
  };

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

        setCandidates(prev => prev.map(c => {
          if (c.sbd.trim().toLowerCase() === mSbd.trim().toLowerCase()) {
            return { ...c, phone: mSdt, residence: mDiaChi };
          }
          return c;
        }));

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

  const handleSelectRecent = (candidate: Candidate) => {
    setMSbd(candidate.sbd);
    setMHoTen(candidate.name);
    setMNgaySinh(candidate.date_of_birth || '');
    setMSdt(candidate.phone || '');
    setMDiaChi(candidate.residence || '');
    setSearchStatus('found');
    setMessage({ type: null, content: '' });

    setTimeout(() => {
      if (phoneInputRef.current) {
        phoneInputRef.current.focus();
        phoneInputRef.current.select();
      }
    }, 50);
  };

  return (
    <>
      <Header
        title="Nhập Liệu Trực Tiếp"
        subtitle="Hệ thống cập nhật thông tin nhận GPLX qua điện thoại và bưu điện"
      />

      <div className="p-4 lg:p-8 space-y-6">
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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
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
                  {/* Số báo danh */}
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

                  {/* Khối hiển thị thông tin */}
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

                  {/* Số điện thoại */}
                  <div className="space-y-2">
                    <label className="text-base font-bold text-neutral-800 dark:text-neutral-200">Số Điện Thoại</label>
                    <input
                      ref={phoneInputRef}
                      type="tel"
                      value={mSdt}
                      onChange={(e) => setMSdt(e.target.value)}
                      placeholder="Nhập SĐT..."
                      className="w-full rounded-lg border border-input bg-transparent px-5 h-20 text-[#2e7d32] tracking-widest outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ fontSize: '38px', fontWeight: '950' }}
                      disabled={searchStatus !== 'found'}
                    />
                  </div>

                  {/* Địa chỉ nhận bưu điện với Gợi ý Thông minh */}
                  <div className="space-y-2 relative">
                    <label className="text-base font-bold text-neutral-800 dark:text-neutral-200">Địa chỉ nhận (qua bưu điện)</label>
                    <input
                      type="text"
                      value={mDiaChi}
                      onChange={(e) => handleAddressChange(e.target.value)}
                      onKeyDown={handleAddressKeyDown}
                      onBlur={handleAddressBlur}
                      onFocus={() => {
                        if (mDiaChi && suggestions.length > 0) setShowSuggestions(true);
                      }}
                      placeholder="Nhập địa chỉ kèm phường/xã hoặc gõ tắt (vd: bs, tqb)..."
                      className="w-full rounded-lg border border-input bg-transparent px-4 h-16 outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                      style={{ fontSize: '24px' }}
                      disabled={searchStatus !== 'found'}
                    />
                    
                    {/* Hộp gợi ý tự động xổ xuống chứa địa chỉ hoàn thiện dự kiến */}
                    {showSuggestions && suggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border bg-popover text-popover-foreground shadow-lg overflow-hidden max-h-64 overflow-y-auto border-border">
                        {suggestions.map((suggestionData, index) => {
                          const { item, matchedTextInInput, matchType } = suggestionData;
                          
                          // Tạo chuỗi xem trước địa chỉ chuẩn hóa sẽ hiển thị
                          let prefix = mDiaChi;
                          if (matchType !== 'direct') {
                            const idx = mDiaChi.toLowerCase().lastIndexOf(matchedTextInInput.toLowerCase());
                            if (idx !== -1) {
                              prefix = mDiaChi.substring(0, idx);
                            }
                          }
                          prefix = prefix.trim().replace(/[,-\s]+$/, '');
                          const formattedPrefix = prefix.split(' ').map((word: string) => {
                            if (/^\d/.test(word)) return word;
                            return word.charAt(0).toUpperCase() + word.slice(1);
                          }).join(' ');

                          const capitalizedWard = item.Name.split(' ')
                            .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                            .join(' ');

                          const displayAddress = formattedPrefix 
                            ? `${formattedPrefix}, ${capitalizedWard}, Tỉnh Gia Lai`
                            : `${capitalizedWard}, Tỉnh Gia Lai`;

                          return (
                            <div
                              key={item.Init}
                              onMouseDown={() => handleSelectSuggestion(suggestionData)}
                              className={`px-4 py-3 text-lg font-medium cursor-pointer transition-colors flex items-center justify-between ${
                                index === activeSuggestionIndex
                                  ? 'bg-primary/10 text-primary font-bold'
                                  : 'hover:bg-muted'
                              }`}
                            >
                              <span className="truncate mr-2">{displayAddress}</span>
                              <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono uppercase shrink-0">
                                {item.Init}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

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