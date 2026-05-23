'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { RefreshCw, Plus, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, ArrowRight, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface GoogleSheetsSyncProps {
  onSyncComplete: (data: Record<string, any[]>) => void;
}

export function GoogleSheetsSync({ onSyncComplete }: GoogleSheetsSyncProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false); // State quản lý việc đóng mở Popover
  const [status, setStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });
  const [sheetCount, setSheetCount] = useState<number>(0);
  const [sheetsList, setSheetsList] = useState<string[]>([]);

  const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1LhWQJVepItW3Ag-vDGsZgmH4rX_TicLtVwD-y696bgk/edit?usp=sharing';

  // Format ngày theo dd-MM-yyyy
  const getSheetNameFromDate = (date: Date) => {
    return format(date, 'dd-MM-yyyy');
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setStatus({ type: null, message: '' });

    try {
      const response = await fetch('/api/sheets/sync');
      const result = await response.json();

      if (result.success) {
        setSheetCount(result.totalSheets);
        setSheetsList(result.sheets || []);
        onSyncComplete(result.data);
        setStatus({
          type: 'success',
          message: `✅ Đã đồng bộ ${result.totalSheets} sheet với ${result.totalCandidates} học viên`,
        });
      } else {
        setStatus({ type: 'error', message: `❌ ${result.error}` });
      }
    } catch (error: any) {
      setStatus({ type: 'error', message: `❌ Lỗi kết nối: ${error.message}` });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateSheet = async () => {
    const sheetName = getSheetNameFromDate(selectedDate);

    setIsCreating(true);
    setStatus({ type: null, message: '' });

    try {
      const response = await fetch('/api/sheets/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetName }),
      });
      const result = await response.json();

      if (result.success) {
        setStatus({ type: 'success', message: `✅ ${result.message}` });
      } else {
        setStatus({ type: 'error', message: `❌ ${result.error}` });
      }
    } catch (error: any) {
      setStatus({ type: 'error', message: `❌ ${error.message}` });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-green-600" />
          Google Sheets Integration
          {sheetCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {sheetCount} sheets
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Nút đồng bộ */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex-1"
            variant="default"
          >
            {isSyncing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Đang đồng bộ...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Đồng bộ từ Google Sheets
              </>
            )}
          </Button>

          <div className="flex gap-2 items-center">
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[200px] justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
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
                      setIsCalendarOpen(false); // Tự động đóng popover khi chọn ngày
                    }
                  }}
                  autoFocus // Đã thay thế initialFocus bằng autoFocus để tương thích v10
                />
              </PopoverContent>
            </Popover>
            <Button
              onClick={handleCreateSheet}
              disabled={isCreating}
              variant="outline"
            >
              {isCreating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1" />
                  Tạo sheet
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Status message */}
        {status.type && (
          <div
            className={`p-3 rounded-lg flex items-center gap-2 text-sm ${
              status.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {status.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
            )}
            <span>{status.message}</span>
          </div>
        )}

        {/* Link mở Google Sheets */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-200">
          <div className="flex items-center gap-2 text-sm text-green-800">
            <FileSpreadsheet className="h-4 w-4" />
            <span className="font-medium">Mở Google Sheets để chỉnh sửa</span>
          </div>
          <a
            href={GOOGLE_SHEET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors"
          >
            Mở ngay
            <ArrowRight className="h-3 w-3" />
          </a>
        </div>

        {/* Danh sách sheets */}
        {sheetsList.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Danh sách sheet ({sheetsList.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {sheetsList.map((sheet) => (
                <Badge key={sheet} variant="secondary" className="text-xs">
                  📅 {sheet}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Hướng dẫn */}
        <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
          💡 <strong>Mẹo:</strong> Mỗi sheet tương ứng với một ngày thi. Tên sheet sẽ là ngày theo định dạng dd-MM-yyyy (VD: 20-01-2025).
          Chọn ngày từ lịch để tạo sheet mới, tránh sai sót khi nhập tay.
          Dữ liệu sẽ tự động được phân loại theo sơ đồ cây quyết định.
        </div>
      </CardContent>
    </Card>
  );
}