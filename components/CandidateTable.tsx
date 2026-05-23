'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Search, Filter, X } from 'lucide-react';
import { Candidate } from '@/types/candidate';

interface CandidateTableProps {
  candidates: Candidate[];
}

type FilterCategory = 'all' | 'no_profile' | 'fail' | 'pass_with_app_postal' | 
                     'pass_with_app_pending' | 'pass_no_fee_returned' | 'pass_no_fee_pending';

export function CandidateTable({ candidates }: CandidateTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');

  // Phân loại ứng viên theo decision tree
  const categorizeCandidate = (candidate: Candidate): FilterCategory => {
    if (!candidate.has_profile) return 'no_profile';
    if (candidate.exam_status === 'Fail') return 'fail';
    
    if (candidate.exam_status === 'Pass') {
      if (candidate.has_app_and_fee) {
        if (candidate.gplx_status === 'Returned' && candidate.has_postal_up) {
          return 'pass_with_app_postal';
        }
        return 'pass_with_app_pending';
      } else {
        if (candidate.gplx_status === 'Returned') {
          return 'pass_no_fee_returned';
        }
        return 'pass_no_fee_pending';
      }
    }
    
    return 'all';
  };

  const filteredCandidates = candidates.filter((candidate) => {
    const matchesSearch = candidate.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         candidate.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeFilter === 'all') return matchesSearch;
    
    return matchesSearch && categorizeCandidate(candidate) === activeFilter;
  });

  const getCategoryCounts = () => {
    const counts = {
      all: candidates.length,
      no_profile: 0,
      fail: 0,
      pass_with_app_postal: 0,
      pass_with_app_pending: 0,
      pass_no_fee_returned: 0,
      pass_no_fee_pending: 0,
    };

    candidates.forEach((candidate) => {
      const category = categorizeCandidate(candidate);
      counts[category]++;
    });

    return counts;
  };

  const counts = getCategoryCounts();

  const filterButtons: { key: FilterCategory; label: string; color: string }[] = [
    { key: 'all', label: 'Tất cả', color: 'bg-gray-100' },
    { key: 'no_profile', label: '❌ Không hồ sơ', color: 'bg-red-100' },
    { key: 'fail', label: '🚫 Rớt', color: 'bg-orange-100' },
    { key: 'pass_with_app_postal', label: '✅ App + Postal', color: 'bg-green-100' },
    { key: 'pass_with_app_pending', label: '⏳ App - Chờ GPLX', color: 'bg-yellow-100' },
    { key: 'pass_no_fee_returned', label: '💸 Chưa Nộp - Có GPLX', color: 'bg-blue-100' },
    { key: 'pass_no_fee_pending', label: '⏸️ Chưa Nộp - Chờ', color: 'bg-purple-100' },
  ];

  const getStatusBadge = (candidate: Candidate) => {
    const category = categorizeCandidate(candidate);
    const config = {
      no_profile: { label: 'Không hồ sơ', variant: 'destructive' as const },
      fail: { label: 'Rớt', variant: 'destructive' as const },
      pass_with_app_postal: { label: 'Đã up postal', variant: 'default' as const },
      pass_with_app_pending: { label: 'Chờ GPLX', variant: 'secondary' as const },
      pass_no_fee_returned: { label: 'Chưa Nộp - GPLX về', variant: 'outline' as const },
      pass_no_fee_pending: { label: 'Chưa Nộp - Chờ', variant: 'secondary' as const },
      all: { label: 'N/A', variant: 'outline' as const },
    };
    return config[category];
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Bảng chi tiết học viên ({filteredCandidates.length}/{candidates.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Thanh tìm kiếm */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm kiếm theo tên hoặc mã học viên..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-2 top-1/2 -translate-y-1/2"
              onClick={() => setSearchTerm('')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Nút lọc nhanh */}
        <div className="flex flex-wrap gap-2">
          {filterButtons.map((button) => (
            <Button
              key={button.key}
              variant={activeFilter === button.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveFilter(button.key)}
              className={`${activeFilter === button.key ? '' : button.color}`}
            >
              {button.label} ({counts[button.key]})
            </Button>
          ))}
        </div>

        {/* Bảng dữ liệu */}
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left">ID</th>
                <th className="px-4 py-2 text-left">Họ tên</th>
                <th className="px-4 py-2 text-left">Ngày thi</th>
                <th className="px-4 py-2 text-left">Hồ sơ</th>
                <th className="px-4 py-2 text-left">Kết quả</th>
                <th className="px-4 py-2 text-left">Đã Nộp Tiền</th>
                <th className="px-4 py-2 text-left">GPLX</th>
                <th className="px-4 py-2 text-left">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {filteredCandidates.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-muted-foreground">
                    Không có dữ liệu phù hợp
                  </td>
                </tr>
              ) : (
                filteredCandidates.map((candidate) => {
                  const statusBadge = getStatusBadge(candidate);
                  return (
                    <tr key={candidate.id} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-2 font-mono text-xs">{candidate.id}</td>
                      <td className="px-4 py-2 font-medium">{candidate.name}</td>
                      <td className="px-4 py-2">{candidate.exam_date}</td>
                      <td className="px-4 py-2">
                        {candidate.has_profile ? '✅' : '❌'}
                      </td>
                      <td className="px-4 py-2">
                        {candidate.exam_status === 'Pass' ? '✅ Đậu' : 
                         candidate.exam_status === 'Fail' ? '❌ Rớt' : '⚪ Chưa thi'}
                      </td>
                      <td className="px-4 py-2">
                        {candidate.has_app_and_fee ? '💰 Đã Nộp' : '💸 Chưa Nộp'}
                      </td>
                      <td className="px-4 py-2">
                        {candidate.gplx_status === 'Returned' ? '📬 Về' : '⏳ Chờ'}
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}