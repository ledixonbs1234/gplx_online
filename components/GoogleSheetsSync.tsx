'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { RefreshCw, Plus, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface GoogleSheetsSyncProps {
  onSyncComplete: (data: Record<string, any[]>) => void;
}

export function GoogleSheetsSync({ onSyncComplete }: GoogleSheetsSyncProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newSheetName, setNewSheetName] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [status, setStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });
  const [sheetCount, setSheetCount] = useState<number>(0);

  const handleSync = async () => {
    setIsSyncing(true);
    setStatus({ type: null, message: '' });

    try {
      const response = await fetch('/api/sheets/sync');
      const result = await response.json();

      if (result.success) {
        setSheetCount(result.totalSheets);
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
    if (!newSheetName.trim()) {
      setStatus({ type: 'error', message: 'Vui lòng nhập tên sheet' });
      return;
    }

    setIsCreating(true);
    setStatus({ type: null, message: '' });

    try {
      const response = await fetch('/api/sheets/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetName: newSheetName }),
      });
      const result = await response.json();

      if (result.success) {
        setStatus({ type: 'success', message: `✅ ${result.message}` });
        setNewSheetName(format(new Date(), 'yyyy-MM-dd'));
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

          <div className="flex gap-2 flex-1">
            <Input
              placeholder="Tên sheet (VD: 2026-05-23)"
              value={newSheetName}
              onChange={(e) => setNewSheetName(e.target.value)}
              className="flex-1"
            />
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

        {/* Hướng dẫn */}
        <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
          💡 <strong>Mẹo:</strong> Mỗi sheet tương ứng với một ngày thi. Tên sheet sẽ là ngày (VD: 2026-05-23).
          Dữ liệu sẽ tự động được phân loại theo sơ đồ cây quyết định.
        </div>
      </CardContent>
    </Card>
  );
}