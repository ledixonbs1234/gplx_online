import { NextResponse } from 'next/server';
import { createNewSheet, getAllSheetNames } from '@/lib/google-sheets';
import { format } from 'date-fns';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sheetName = body.sheetName || format(new Date(), 'yyyy-MM-dd');

    // Kiểm tra sheet đã tồn tại chưa
    const existingSheets = await getAllSheetNames();
    if (existingSheets.includes(sheetName)) {
      return NextResponse.json(
        { success: false, error: `Sheet "${sheetName}" đã tồn tại` },
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