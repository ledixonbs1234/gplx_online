'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, Users, FileSpreadsheet, Search, Plus, ExternalLink } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface Candidate {
  id: string;
  name: string;
  exam_date: string;
  has_profile: boolean;
  exam_status: 'Pass' | 'Fail' | 'Not_Tested';
  has_app_and_fee: boolean;
  gplx_status: 'Returned' | 'Pending';
  has_postal_up?: boolean;
}

const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1LhWQJVepItW3Ag-vDGsZgmH4rX_TicLtVwD-y696bgk/edit?usp=sharing';

export default function CandidatesPage() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sheetsList, setSheetsList] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

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

  // Load dữ liệu học viên theo ngày thi
  useEffect(() => {
    const loadCandidates = async () => {
      if (!selectedDate) return;
      
      setIsLoading(true);
      try {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
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
    c.id.toLowerCase().includes(searchTerm.toLowerCase())
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
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, 'PPP', { locale: vi }) : 'Chọn ngày'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
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
                      variant={format(selectedDate, 'yyyy-MM-dd') === sheet ? 'default' : 'secondary'}
                      className="cursor-pointer"
                      onClick={() => setSelectedDate(new Date(sheet))}
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
                {isLoading && <span className="text-sm text-muted-foreground">Đang tải...</span>}
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
                        <th className="text-left py-3 px-4 font-semibold">Mã HV</th>
                        <th className="text-left py-3 px-4 font-semibold">Họ tên</th>
                        <th className="text-center py-3 px-4 font-semibold">Hồ sơ</th>
                        <th className="text-center py-3 px-4 font-semibold">Kết quả</th>
                        <th className="text-center py-3 px-4 font-semibold">Đã Nộp Tiền</th>
                        <th className="text-center py-3 px-4 font-semibold">GPLX</th>
                        <th className="text-center py-3 px-4 font-semibold">Postal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCandidates.map((candidate) => (
                        <tr key={candidate.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-4 font-mono text-sm">{candidate.id}</td>
                          <td className="py-3 px-4 font-medium">{candidate.name}</td>
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
