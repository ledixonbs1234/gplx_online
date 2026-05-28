// plx_online/app/api/sheets/sync/route.ts
import { NextResponse } from 'next/server';
import { readAllSheets, getAllSheetNames } from '@/lib/google-sheets';

export const dynamic = 'force-dynamic'; // Không cache HTTP Next.js

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    // 1. Chỉ lấy danh sách tên các ngày thi (Cực kỳ nhanh, sử dụng RAM Cache)
    if (type === 'list') {
      const sheetNames = await getAllSheetNames();
      return NextResponse.json({
        success: true,
        sheets: sheetNames,
      });
    }

    // 2. Đồng bộ toàn bộ dữ liệu (Chỉ chạy khi người dùng nhấn nút Đồng bộ ở Dashboard)
    console.log('🔄 Bắt đầu đồng bộ từ Google Sheets...');
    const sheetNames = await getAllSheetNames();
    console.log(`📋 Tìm thấy ${sheetNames.length} sheet:`, sheetNames);
    
    const candidatesByDate = await readAllSheets();
    
    // Chuyển đổi Map sang object để tuần tự hóa JSON
    const result: Record<string, any[]> = {};
    candidatesByDate.forEach((candidates, date) => {
      result[date] = candidates;
    });

    return NextResponse.json({
      success: true,
      sheets: sheetNames,
      data: result,
      totalSheets: sheetNames.length,
      totalCandidates: Object.values(result).reduce((sum, arr) => sum + arr.length, 0),
    });
  } catch (error: any) {
    console.error('❌ Lỗi đồng bộ:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Lỗi không xác định',
        hint: 'Kiểm tra file google-credentials.json và GOOGLE_SHEET_ID trong .env.local',
      },
      { status: 500 }
    );
  }
}