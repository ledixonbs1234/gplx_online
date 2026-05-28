// plx_online/app/api/sheets/upload/route.ts
import { NextResponse } from 'next/server';
import { createNewSheet, getAllSheetNames, updateCandidatesInSheet, findSheetNameWithFallback } from '@/lib/google-sheets';
import { sheetsCache } from '@/lib/cache';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { date, candidates } = body;

    if (!date || !Array.isArray(candidates)) {
      return NextResponse.json(
        { success: false, error: 'Thiếu ngày thi hoặc danh sách học viên' },
        { status: 400 }
      );
    }

    const resolvedName = await findSheetNameWithFallback(date);
    const existingSheets = await getAllSheetNames(true);

    // Tạo mới sheet nếu ngày thi đó chưa có trong hệ thống
    if (!existingSheets.includes(resolvedName)) {
      console.log(`📝 Đang tạo sheet mới cho ngày thi: ${resolvedName}`);
      await createNewSheet(resolvedName);
    }

    // Đè toàn bộ danh sách dữ liệu mới lên sheet
    await updateCandidatesInSheet(resolvedName, candidates);

    // Làm mới cache hiển thị
    sheetsCache.delete(`sheets_data_${resolvedName}`);
    sheetsCache.delete(`sheets_data_single_${resolvedName}`);
    sheetsCache.delete('sheets_data_all');

    return NextResponse.json({
      success: true,
      message: `Đã lưu trữ và tối ưu giao diện thành công ${candidates.length} học viên ngày ${resolvedName}`,
    });
  } catch (error: any) {
    console.error('Lỗi khi tải dữ liệu lên Google Sheets:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Lỗi bốc tách và đồng bộ hệ thống' },
      { status: 500 }
    );
  }
}