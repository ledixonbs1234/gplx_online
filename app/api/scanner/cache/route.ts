import { NextResponse } from 'next/server';
import { sheetsCache } from '@/lib/cache';

/**
 * API để xóa cache thủ công
 * Hữu ích khi cần làm mới dữ liệu sau khi cập nhật Google Sheets
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { date } = body || {};

    if (date) {
      // Xóa cache cho một ngày cụ thể
      const cacheKey = `sheets_data_${date}`;
      sheetsCache.delete(cacheKey);
      console.log(`🗑️ Đã xóa cache cho ngày: ${date}`);
      
      return NextResponse.json({
        success: true,
        message: `Đã xóa cache cho ngày ${date}`,
        cacheKey,
      });
    } else {
      // Xóa toàn bộ cache
      sheetsCache.clear();
      console.log('🗑️ Đã xóa toàn bộ cache');
      
      return NextResponse.json({
        success: true,
        message: 'Đã xóa toàn bộ cache',
      });
    }
  } catch (error: any) {
    console.error('Error clearing cache:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * API để kiểm tra trạng thái cache
 */
export async function GET() {
  try {
    const cacheInfo = sheetsCache.getInfo();
    
    return NextResponse.json({
      success: true,
      cache: {
        size: cacheInfo.size,
        keys: cacheInfo.keys,
      },
    });
  } catch (error: any) {
    console.error('Error getting cache info:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
