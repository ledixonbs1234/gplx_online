// plx_online/app/api/sheets/update-code/route.ts
import { NextResponse } from 'next/server';
import { readAllSheets, updateCandidatesInSheet, readSheet } from '@/lib/google-sheets';
import { sheetsCache } from '@/lib/cache';
import { Candidate } from '@/types/candidate';

export const dynamic = 'force-dynamic';

interface ExcelRow {
  sbd: string;
  fullName: string;
  dateOfBirth: string;
  code: string;
}

/**
 * Chuyển đổi mã ngày của Excel (Serial Date Number) thành chuỗi dd/MM/yyyy
 */
function excelSerialToDateString(serial: string | number): string {
  const num = Number(serial);
  if (isNaN(num) || num <= 0) return String(serial);
  const utcDays = num - 25569; // Số ngày chênh lệch giữa năm 1900 và 1970
  const dateObj = new Date(utcDays * 86400 * 1000);
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Chuẩn hóa chuỗi tên để so sánh không dấu, bỏ ký tự đặc biệt
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Loại bỏ các dấu tiếng Việt
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9 ]/g, '') // Chỉ giữ lại ký tự chữ cái và số
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tìm kiếm nhị phân trên tập dữ liệu đã sắp xếp theo SBD tăng dần (Tối ưu cực cao)
 */
function binarySearchBySBD(candidates: Candidate[], targetSBD: string): number[] {
  const target = parseInt(targetSBD, 10);
  if (isNaN(target)) return [];

  let left = 0;
  let right = candidates.length - 1;
  const matches: number[] = [];

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const currentVal = parseInt(candidates[mid].sbd, 10);

    if (isNaN(currentVal)) {
      left = mid + 1; // Bỏ qua dữ liệu lỗi không phải số
      continue;
    }

    if (currentVal === target) {
      matches.push(mid);
      // Tìm kiếm các phần tử lân cận có SBD trùng khớp (nếu có)
      let l = mid - 1;
      while (l >= 0 && parseInt(candidates[l].sbd, 10) === target) {
        matches.push(l);
        l--;
      }
      let r = mid + 1;
      while (r < candidates.length && parseInt(candidates[r].sbd, 10) === target) {
        matches.push(r);
        r++;
      }
      break;
    } else if (currentVal < target) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  return matches;
}

/**
 * Hàm tìm kiếm thí sinh phù hợp trong tập dữ liệu của một Sheet
 */
function findMatchesInSheet(
  sheetCandidates: Candidate[],
  excelSbd: string,
  excelName: string,
  excelDob: string
): Candidate[] {
  const matches: Candidate[] = [];
  const normExcelName = normalizeName(excelName);
  const cleanExcelSbd = excelSbd.trim();

  const normalizeDob = (d: string) => d.replace(/[\-\/]/g, '').trim();
  const eDobNorm = excelDob ? normalizeDob(excelDob) : '';
  let eDobConvertedNorm = '';
  if (/^\d{5}$/.test(excelDob)) {
    const converted = excelSerialToDateString(excelDob);
    eDobConvertedNorm = normalizeDob(converted);
  }

  // 1. Nếu có SBD, thực hiện thuật toán Tìm kiếm nhị phân trước (tối ưu hóa tốc độ)
  if (cleanExcelSbd && /^\d+$/.test(cleanExcelSbd)) {
    const indices = binarySearchBySBD(sheetCandidates, cleanExcelSbd);
    if (indices.length > 0) {
      for (const idx of indices) {
        const cand = sheetCandidates[idx];
        const candName = normalizeName(cand.name);
        const nameMatch = !normExcelName || candName === normExcelName || candName.includes(normExcelName) || normExcelName.includes(candName);
        if (nameMatch) {
          matches.push(cand);
        }
      }
      return matches; // Trả về kết quả nếu tìm thấy bằng SBD
    }
  }

  // 2. Chế độ quét tuyến tính dự phòng (Khi không có SBD hoặc tìm kiếm nhị phân không khớp)
  for (const cand of sheetCandidates) {
    const candSbd = String(cand.sbd).trim();
    const candName = normalizeName(cand.name);
    const cDobNorm = cand.date_of_birth ? normalizeDob(cand.date_of_birth) : '';

    if (cleanExcelSbd && normExcelName) {
      const sbdMatch = candSbd === cleanExcelSbd;
      const nameMatch = candName === normExcelName || candName.includes(normExcelName) || normExcelName.includes(candName);
      if (sbdMatch && nameMatch) {
        matches.push(cand);
      }
    } else if (cleanExcelSbd) {
      if (candSbd === cleanExcelSbd) {
        matches.push(cand);
      }
    } else if (normExcelName) {
      const nameMatch = candName === normExcelName || candName.includes(normExcelName);
      if (nameMatch) {
        if (eDobNorm) {
          if (cDobNorm === eDobNorm || (eDobConvertedNorm && cDobNorm === eDobConvertedNorm)) {
            matches.push(cand);
          }
        } else {
          matches.push(cand);
        }
      }
    }
  }

  return matches;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    // Xử lý hành động giải quyết ghi đè trùng lặp do người dùng chỉ định sheet cụ thể
    if (action === 'resolve_conflict') {
      const { sheetName, sbd, code } = body;
      if (!sheetName || !sbd || !code) {
        return NextResponse.json({ success: false, error: 'Thiếu thông tin cập nhật' }, { status: 400 });
      }

      const candidates = await readSheet(sheetName);
      const idx = candidates.findIndex(c => String(c.sbd).trim() === String(sbd).trim());
      if (idx !== -1) {
        candidates[idx] = {
          ...candidates[idx],
          tracking_number: code,
          has_postal_up: true,
          exam_status: 'Pass',
          gplx_status: 'Returned',
          has_app_and_fee: true,
          has_profile: true,
        };
        await updateCandidatesInSheet(sheetName, candidates);

        // Xóa bộ nhớ đệm Cache
        sheetsCache.delete(`sheets_data_${sheetName}`);
        sheetsCache.delete(`sheets_data_single_${sheetName}`);
        sheetsCache.delete('sheets_data_all');

        return NextResponse.json({ success: true, message: `Ghi đè mã hiệu bưu điện thành công!` });
      } else {
        return NextResponse.json({ success: false, error: 'Không tìm thấy thông tin thí sinh trong sheet được chỉ định' }, { status: 404 });
      }
    }

    // Hành động chính: phân tích dữ liệu Excel và tự động phân loại đối chiếu
    const { excelData } = body;
    if (!excelData || !Array.isArray(excelData) || excelData.length === 0) {
      return NextResponse.json({ success: false, error: 'Dữ liệu danh sách Excel rỗng hoặc không hợp lệ' }, { status: 400 });
    }

    // Tải toàn bộ dữ liệu từ Google Sheets
    const allSheetsData = await readAllSheets();
    
    const autoUpdatesGrouped: Record<string, Candidate[]> = {};
    const conflicts: any[] = [];
    const unmatched: any[] = [];
    let autoUpdatedCount = 0;

    for (const row of excelData) {
      const excelSbd = String(row.sbd || '').trim();
      const excelName = String(row.fullName || row.name || '').trim();
      const excelDob = String(row.dateOfBirth || '').trim();
      const excelCode = String(row.code || '').trim();

      if (!excelName && !excelSbd) continue;

      const rowMatches: { sheetName: string; candidate: Candidate; originalIndex: number }[] = [];

      // Đối chiếu trên từng sheet
      for (const [sheetName, sheetCandidates] of allSheetsData.entries()) {
        const matches = findMatchesInSheet(sheetCandidates, excelSbd, excelName, excelDob);
        for (const cand of matches) {
          const originalIndex = sheetCandidates.findIndex(c => c.sbd === cand.sbd);
          rowMatches.push({ sheetName, candidate: cand, originalIndex });
        }
      }

      if (rowMatches.length === 1) {
        // Khớp duy nhất 1 kết quả -> Tự động cập nhật
        const { sheetName, candidate, originalIndex } = rowMatches[0];
        
        if (!autoUpdatesGrouped[sheetName]) {
          autoUpdatesGrouped[sheetName] = [...(allSheetsData.get(sheetName) || [])];
        }

        const candidatesList = autoUpdatesGrouped[sheetName];
        if (originalIndex !== -1 && candidatesList[originalIndex]) {
          candidatesList[originalIndex] = {
            ...candidatesList[originalIndex],
            tracking_number: excelCode || candidatesList[originalIndex].tracking_number,
            has_postal_up: true,
            exam_status: 'Pass',
            gplx_status: 'Returned',
            has_app_and_fee: true,
            has_profile: true,
          };
          autoUpdatedCount++;
        }
      } else if (rowMatches.length > 1) {
        // Trùng lặp ở nhiều sheet khác nhau -> Đưa vào danh sách conflict để chờ xác nhận thủ công
        conflicts.push({
          excelRow: row,
          matches: rowMatches.map(m => ({
            sheetName: m.sheetName,
            name: m.candidate.name,
            sbd: m.candidate.sbd,
            date_of_birth: m.candidate.date_of_birth || ''
          }))
        });
      } else {
        // Không tìm thấy kết quả phù hợp -> Đưa vào danh sách chờ xử lý thủ công
        unmatched.push(row);
      }
    }

    // Lưu hàng loạt các trường hợp khớp tự động lên Google Sheets
    for (const [sheetName, updatedList] of Object.entries(autoUpdatesGrouped)) {
      await updateCandidatesInSheet(sheetName, updatedList);
      sheetsCache.delete(`sheets_data_${sheetName}`);
      sheetsCache.delete(`sheets_data_single_${sheetName}`);
    }

    if (autoUpdatedCount > 0) {
      sheetsCache.delete('sheets_data_all');
    }

    return NextResponse.json({
      success: true,
      autoUpdatedCount,
      conflicts,
      unmatched,
      totalProcessed: excelData.length
    });

  } catch (error: any) {
    console.error('Lỗi API cập nhật mã hiệu:', error);
    return NextResponse.json({ success: false, error: error.message || 'Lỗi hệ thống' }, { status: 500 });
  }
}