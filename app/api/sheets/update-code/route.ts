import { NextResponse } from 'next/server';
import { readSheet, updateCandidatesInSheet } from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';

interface ExcelCandidate {
  sbd: string;
  name: string;
  dateOfBirth?: string;
  code?: string; // Mã hiệu từ cột F
}

/**
 * API để cập nhật mã hiệu từ file Excel vào Google Sheet
 * 
 * Request body:
 * - examDate: ngày thi (tên sheet)
 * - excelData: danh sách thí sinh từ file Excel với các trường:
 *   + sbd: số báo danh
 *   + fullName: họ tên đầy đủ
 *   + dateOfBirth: ngày sinh
 *   + code: mã hiệu (từ cột F)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { examDate, excelData } = body;

    if (!examDate) {
      return NextResponse.json(
        { success: false, error: 'Thiếu ngày thi (examDate)' },
        { status: 400 }
      );
    }

    if (!excelData || !Array.isArray(excelData) || excelData.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Không có dữ liệu Excel' },
        { status: 400 }
      );
    }

    // Đọc dữ liệu hiện tại từ Google Sheet
    const sheetCandidates = await readSheet(examDate);
    
    if (sheetCandidates.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Không tìm thấy dữ liệu cho ngày thi ${examDate}` 
        },
        { status: 404 }
      );
    }

    // Cập nhật thông tin cho từng thí sinh từ Excel
    const updatedCandidates = [...sheetCandidates];
    let updatedCount = 0;
    let notFoundCount = 0;
    const notFoundSBDs: string[] = [];

    for (const excelRow of excelData) {
      const excelSBD = String(excelRow.sbd).trim();
      const excelName = normalizeName(String(excelRow.fullName || excelRow.name || '').trim());
      const excelCode = excelRow.code || excelRow.maHieu || excelRow['Mã Hiệu'];
      
      // Tìm thí sinh khớp trong Google Sheet
      const matchIndex = updatedCandidates.findIndex(c => {
        const sheetSBD = String(c.sbd).trim();
        const sheetName = normalizeName(c.name.trim());
        
        // So sánh SBD và tên (không phân biệt hoa thường, dấu câu)
        return sheetSBD === excelSBD && sheetName === excelName;
      });

      if (matchIndex !== -1) {
        // Cập nhật thông tin
        updatedCandidates[matchIndex] = {
          ...updatedCandidates[matchIndex],
          tracking_number: excelCode || updatedCandidates[matchIndex].tracking_number,
          has_postal_up: true,
          exam_status: 'Pass' as const,
          gplx_status: 'Returned' as const, 
          has_app_and_fee: true,
          has_profile: true,
        };
        updatedCount++;
      } else {
        notFoundCount++;
        notFoundSBDs.push(`${excelSBD} - ${excelRow.fullName || excelRow.name}`);
      }
    }

    // Ghi lại vào Google Sheet
    if (updatedCount > 0) {
      await updateCandidatesInSheet(examDate, updatedCandidates);
    }

    return NextResponse.json({
      success: true,
      message: `Cập nhật thành công ${updatedCount} thí sinh`,
      updatedCount,
      notFoundCount,
      notFoundSBDs: notFoundSBDs.slice(0, 10), // Chỉ trả về 10 cái đầu để tránh quá dài
      totalProcessed: excelData.length,
    });
  } catch (error: any) {
    console.error('Error updating candidates:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Lỗi không xác định' },
      { status: 500 }
    );
  }
}

/**
 * Chuẩn hóa tên để so sánh (loại bỏ dấu, viết hoa chuẩn)
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Loại bỏ dấu
    .replace(/\s+/g, ' ') // Nhiều khoảng trắng thành 1
    .trim();
}
