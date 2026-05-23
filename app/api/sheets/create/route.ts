import { NextResponse } from 'next/server';
import { createNewSheet, getAllSheetNames, findSheetNameWithFallback } from '@/lib/google-sheets';
import { format } from 'date-fns';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sheetName = body.sheetName || format(new Date(), 'dd-MM-yyyy'); // Mặc định chuyển sang dd-MM-yyyy

    // Kiểm tra sheet đã tồn tại chưa (Sử dụng cơ chế Fallback để check chéo định dạng)
    const resolvedName = await findSheetNameWithFallback(sheetName);
    const existingSheets = await getAllSheetNames();
    if (existingSheets.includes(resolvedName)) {
      return NextResponse.json(
        { success: false, error: `Sheet "${resolvedName}" đã tồn tại` },
        { status: 400 }
      );
    }

    await createNewSheet(sheetName);

    return NextResponse.json({
      success: true,
      sheetName,
      message: `Đã tạo sheet "${sheetName}" thành công`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}