import { NextResponse } from 'next/server';
import { readAllSheets, findSheetNameWithFallback, readSheet } from '@/lib/google-sheets';
import { Candidate } from '@/types/candidate';

export const dynamic = 'force-dynamic';

/**
 * API tìm kiếm thí sinh theo:
 * - code: Mã hiệu (tìm trong tất cả các sheets hoặc theo ngày thi)
 * - query: Tên hoặc SBD (tìm kiếm gần đúng)
 * - date: Lọc theo ngày thi (sheet name), mặc định "all" là tìm toàn bộ
 * - type: 'code' (mã hiệu) hoặc 'name_sbd' (tên/SBD)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const query = searchParams.get('query');
    const date = searchParams.get('date') || 'all';
    const searchType = searchParams.get('type') || 'code';

    let candidates: Candidate[] = [];
    let allData: Map<string, Candidate[]> = new Map();

    // Đọc dữ liệu từ tất cả sheets hoặc chỉ sheet được chọn
    if (date === 'all') {
      allData = await readAllSheets();
    } else {
      const resolvedSheetName = await findSheetNameWithFallback(date);
      try {
        const sheetCandidates = await readSheet(resolvedSheetName);
        allData.set(resolvedSheetName, sheetCandidates);
      } catch (error) {
        // Sheet không tồn tại, trả về rỗng
        return NextResponse.json({
          success: true,
          candidates: [],
          message: `Không tìm thấy sheet cho ngày ${date}`,
        });
      }
    }

    // Tìm kiếm theo mã hiệu (QR code)
    if (code) {
      const searchTerm = code.toLowerCase().trim();
      
      for (const [sheetName, sheetCandidates] of allData.entries()) {
        for (const candidate of sheetCandidates) {
          // Tìm mã hiệu trong các trường có thể chứa mã
          const codeFields = [
            candidate.sbd,
            candidate.tracking_number,
            candidate.phone,
          ].filter(Boolean).map(f => String(f).toLowerCase().trim());

          // Kiểm tra nếu mã hiệu khớp CHÍNH XÁC với bất kỳ trường nào
          // Chỉ khớp chính xác hoàn toàn, không dùng includes
          if (codeFields.some(field => field === searchTerm)) {
            candidates.push({
              ...candidate,
              exam_date: sheetName,
            });
          }
        }
      }
    }
    // Tìm kiếm theo tên hoặc SBD
    else if (query) {
      const searchTerm = query.toLowerCase().trim();
      
      // Kiểm tra xem searchTerm có phải là số thuần túy không (SBD)
      const isPureNumber = /^\d+$/.test(searchTerm);
      
      for (const [sheetName, sheetCandidates] of allData.entries()) {
        for (const candidate of sheetCandidates) {
          let nameMatch = false;
          let sbdMatch = false;
          
          if (isPureNumber) {
            // Nếu là số thuần túy, chỉ khớp chính xác SBD
            sbdMatch = candidate.sbd.toLowerCase().trim() === searchTerm;
          } else {
            // Nếu không phải số thuần túy, tìm gần đúng theo tên hoặc SBD
            nameMatch = candidate.name.toLowerCase().includes(searchTerm);
            sbdMatch = candidate.sbd.toLowerCase().includes(searchTerm);
          }
          
          if (nameMatch || sbdMatch) {
            candidates.push({
              ...candidate,
              exam_date: sheetName,
            });
          }
        }
      }
    }

    // Loại bỏ trùng lặp (cùng SBD và ngày thi)
    const uniqueCandidates = candidates.filter(
      (c, index, self) =>
        index === self.findIndex((t) => t.sbd === c.sbd && t.exam_date === c.exam_date)
    );

    return NextResponse.json({
      success: true,
      candidates: uniqueCandidates,
      total: uniqueCandidates.length,
    });
  } catch (error: any) {
    console.error('Error searching candidates:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
