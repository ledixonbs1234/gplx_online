// plx_online/app/api/sheets/data/route.ts
import { NextResponse } from 'next/server';
import { readSheet, getAllSheetNames, findSheetNameWithFallback } from '@/lib/google-sheets';
import { sheetsCache } from '@/lib/cache';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date) {
      return NextResponse.json(
        { success: false, error: 'Thiếu tham số date' },
        { status: 400 }
      );
    }

    // Tạo cache key riêng biệt cho dữ liệu chi tiết của ngày thi được chọn
    const cacheKey = `sheets_data_single_${date}`;
    const cachedCandidates = sheetsCache.get<any[]>(cacheKey);

    if (cachedCandidates) {
      return NextResponse.json({
        success: true,
        candidates: cachedCandidates,
        total: cachedCandidates.length,
        fromCache: true
      });
    }

    // Tự động tìm kiếm tên sheet phù hợp thông qua cơ chế Fallback
    const resolvedSheetName = await findSheetNameWithFallback(date);
    const existingSheets = await getAllSheetNames();
    
    if (!existingSheets.includes(resolvedSheetName)) {
      return NextResponse.json(
        { 
          success: true, 
          candidates: [],
          message: `Không tìm thấy sheet cho ngày ${date}`
        }
      );
    }

    // Đọc dữ liệu từ sheet thực tế đã được dò tìm thấy
    const candidates = await readSheet(resolvedSheetName);

    // Lưu trữ vào RAM Cache trong vòng 3 phút
    sheetsCache.set(cacheKey, candidates, 3);

    return NextResponse.json({
      success: true,
      candidates,
      total: candidates.length,
    });
  } catch (error: any) {
    console.error('Error fetching sheet data:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}