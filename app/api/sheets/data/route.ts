import { NextResponse } from 'next/server';
import { readSheet, getAllSheetNames } from '@/lib/google-sheets';

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

    // Kiểm tra sheet có tồn tại không
    const existingSheets = await getAllSheetNames();
    if (!existingSheets.includes(date)) {
      return NextResponse.json(
        { 
          success: true, 
          candidates: [],
          message: `Không tìm thấy sheet cho ngày ${date}`
        }
      );
    }

    // Đọc dữ liệu từ sheet
    const candidates = await readSheet(date);

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
