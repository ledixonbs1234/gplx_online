import { NextResponse } from 'next/server';
import { readAllSheets, getAllSheetNames } from '@/lib/google-sheets';

export const dynamic = 'force-dynamic'; // Không cache

export async function GET() {
  try {
    console.log('🔄 Bắt đầu đồng bộ từ Google Sheets...');
    
    const sheetNames = await getAllSheetNames();
    console.log(`📋 Tìm thấy ${sheetNames.length} sheet:`, sheetNames);
    
    const candidatesByDate = await readAllSheets();
    
    // Convert Map sang object để serialize JSON
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