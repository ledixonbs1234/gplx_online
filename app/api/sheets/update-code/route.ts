// plx_online/app/api/sheets/update-code/route.ts
import { NextResponse } from 'next/server';
import { readAllSheets, updateCandidatesInSheet, readSheet } from '@/lib/google-sheets';
import { sheetsCache } from '@/lib/cache';
import { Candidate } from '@/types/candidate';
import { getAdminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

interface ExcelRow {
  sbd: string;
  fullName: string;
  dateOfBirth: string;
  code: string;
}

function excelSerialToDateString(serial: string | number): string {
  const num = Number(serial);
  if (isNaN(num) || num <= 0) return String(serial);
  const utcDays = num - 25569;
  const dateObj = new Date(utcDays * 86400 * 1000);
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  return `${day}/${month}/${year}`;
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

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
      left = mid + 1;
      continue;
    }

    if (currentVal === target) {
      matches.push(mid);
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
      return matches;
    }
  }

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

/**
 * API GET: Lấy toàn bộ danh sách lưu trữ (Xung đột, Thiếu thông tin, Không tồn tại) từ Firebase
 */
export async function GET() {
  try {
    const db = getAdminDb();
    
    // Đồng thời lấy cả 3 danh sách từ database
    const [conflictsSnap, incompleteSnap, unmatchedSnap] = await Promise.all([
      db.ref('unresolved_conflicts').once('value'),
      db.ref('incomplete_records').once('value'),
      db.ref('unmatched_records').once('value')
    ]);

    const conflictsVal = conflictsSnap.val() || {};
    const incompleteVal = incompleteSnap.val() || {};
    const unmatchedVal = unmatchedSnap.val() || {};

    const conflicts = Object.entries(conflictsVal).map(([key, data]: [string, any]) => ({
      ...data,
      conflictKey: key
    }));

    const incompleteRecords = Object.entries(incompleteVal).map(([key, data]: [string, any]) => ({
      ...data,
      recordKey: key
    }));

    const unmatched = Object.entries(unmatchedVal).map(([key, data]: [string, any]) => ({
      ...data,
      unmatchedKey: key
    }));

    return NextResponse.json({ 
      success: true, 
      conflicts,
      incompleteRecords,
      unmatched
    });
  } catch (error: any) {
    console.error('Lỗi khi nạp dữ liệu lưu trữ:', error);
    return NextResponse.json({ success: false, error: error.message });
  }
}

/**
 * API POST: Xử lý cập nhật, đối chiếu, thêm và xóa trạng thái các bản ghi
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;
    const db = getAdminDb();

    // HÀNH ĐỘNG 1: XÓA TỪNG BẢN GHI XUNG ĐỘT TRÙNG KHỚP
    if (action === 'delete_conflict') {
      const { conflictKey } = body;
      if (!conflictKey) {
        return NextResponse.json({ success: false, error: 'Thiếu mã khóa xung đột cần xóa' }, { status: 400 });
      }
      await db.ref(`unresolved_conflicts/${conflictKey}`).remove();
      return NextResponse.json({ success: true, message: 'Đã xóa bản ghi xung đột thành công' });
    }

    // HÀNH ĐỘNG 2: XÓA TOÀN BỘ DANH SÁCH XUNG ĐỘT
    if (action === 'delete_all_conflicts') {
      await db.ref('unresolved_conflicts').remove();
      return NextResponse.json({ success: true, message: 'Đã dọn dẹp danh sách xung đột thành công' });
    }

    // HÀNH ĐỘNG 3: XÓA TỪNG BẢN GHI THIẾU THÔNG TIN
    if (action === 'delete_incomplete_record') {
      const { recordKey } = body;
      if (!recordKey) {
        return NextResponse.json({ success: false, error: 'Thiếu mã khóa bản ghi cần xóa' }, { status: 400 });
      }
      await db.ref(`incomplete_records/${recordKey}`).remove();
      return NextResponse.json({ success: true, message: 'Đã xóa bản ghi thiếu thông tin thành công' });
    }

    // HÀNH ĐỘNG 4: XÓA TOÀN BỘ DANH SÁCH THIẾU THÔNG TIN
    if (action === 'delete_all_incomplete_records') {
      await db.ref('incomplete_records').remove();
      return NextResponse.json({ success: true, message: 'Đã dọn dẹp danh sách thiếu thông tin thành công' });
    }

    // HÀNH ĐỘNG 5: XÓA TỪNG BẢN GHI KHÔNG TỒN TẠI (UNMATCHED)
    if (action === 'delete_unmatched_record') {
      const { unmatchedKey } = body;
      if (!unmatchedKey) {
        return NextResponse.json({ success: false, error: 'Thiếu mã khóa bản ghi không khớp cần xóa' }, { status: 400 });
      }
      await db.ref(`unmatched_records/${unmatchedKey}`).remove();
      return NextResponse.json({ success: true, message: 'Đã xóa bản ghi không khớp thành công' });
    }

    // HÀNH ĐỘNG 6: XÓA TOÀN BỘ DANH SÁCH KHÔNG TỒN TẠI
    if (action === 'delete_all_unmatched_records') {
      await db.ref('unmatched_records').remove();
      return NextResponse.json({ success: true, message: 'Đã dọn dẹp danh sách không tồn tại thành công' });
    }

    // TÁC VỤ 1: GIẢI QUYẾT XUNG ĐỘT THỦ CÔNG HOẶC THIẾU THÔNG TIN
    if (action === 'resolve_conflict') {
      const { sheetName, sbd, code, conflictKey, recordKey, fullName } = body;
      
      if (!sheetName || (!sbd && !fullName) || !code) {
        return NextResponse.json({ success: false, error: 'Thiếu thông tin cập nhật' }, { status: 400 });
      }

      const candidates = await readSheet(sheetName);
      let idx = -1;

      if (sbd && sbd.trim() !== '') {
        idx = candidates.findIndex(c => String(c.sbd).trim() === String(sbd).trim());
      } else if (fullName && fullName.trim() !== '') {
        const normTargetName = normalizeName(fullName);
        const matches: number[] = [];

        candidates.forEach((cand, i) => {
          if (normalizeName(cand.name) === normTargetName) {
            matches.push(i);
          }
        });

        if (matches.length === 1) {
          idx = matches[0];
        } else if (matches.length > 1) {
          return NextResponse.json({
            success: false,
            error: `Trùng tên! Có ${matches.length} học viên cùng tên "${fullName}" trong ngày thi ${sheetName}. Vui lòng bổ sung SBD.`
          }, { status: 400 });
        } else {
          return NextResponse.json({
            success: false,
            error: `Không tìm thấy học viên nào tên "${fullName}" trong ngày thi ${sheetName}.`
          }, { status: 404 });
        }
      }

      if (idx !== -1) {
        const originalCand = candidates[idx];

        candidates[idx] = {
          ...originalCand,
          tracking_number: code,
          exam_status: 'Pass',
          gplx_status: 'Returned',
          has_app_and_fee: true,
          has_profile: true,
        };
        await updateCandidatesInSheet(sheetName, candidates);

        // Xóa hoàn toàn bản ghi khỏi Firebase nếu giải quyết xong
        if (conflictKey) {
          await db.ref(`unresolved_conflicts/${conflictKey}`).remove();
        }
        if (recordKey) {
          await db.ref(`incomplete_records/${recordKey}`).remove();
        }

        sheetsCache.delete(`sheets_data_${sheetName}`);
        sheetsCache.delete(`sheets_data_single_${sheetName}`);
        sheetsCache.delete('sheets_data_all');

        return NextResponse.json({ 
          success: true, 
          message: `Ghi đè mã hiệu bưu điện thành công cho học viên "${originalCand.name}" (SBD: ${originalCand.sbd})!` 
        });
      } else {
        return NextResponse.json({ success: false, error: 'Không tìm thấy thông tin thí sinh trong ngày thi được chỉ định' }, { status: 404 });
      }
    }

    // TÁC VỤ 2: LÀM MỚI / CHẠY LẠI ĐỐI CHIẾU DANH SÁCH XUNG ĐỘT
    if (action === 're_evaluate') {
      const unresolvedRef = db.ref('unresolved_conflicts');
      const unresolvedSnap = await unresolvedRef.once('value');
      
      if (!unresolvedSnap.exists()) {
        return NextResponse.json({ success: true, message: 'Không có dữ liệu xung đột nào để chạy lại.', resolvedCount: 0 });
      }

      const currentConflicts: Record<string, any> = unresolvedSnap.val();
      const allSheetsData = await readAllSheets();
      
      let resolvedCount = 0;
      const autoUpdatesGrouped: Record<string, Candidate[]> = {};
      const keysToRemove: string[] = [];

      for (const [key, conflict] of Object.entries(currentConflicts)) {
        const excelRow = conflict.excelRow;
        const excelSbd = String(excelRow.sbd || '').trim();
        const excelName = String(excelRow.fullName || excelRow.name || '').trim();
        const excelDob = String(excelRow.dateOfBirth || '').trim();
        const excelCode = String(excelRow.code || '').trim();

        const rowMatches: { sheetName: string; candidate: Candidate; originalIndex: number }[] = [];

        for (const [sheetName, sheetCandidates] of allSheetsData.entries()) {
          const matches = findMatchesInSheet(sheetCandidates, excelSbd, excelName, excelDob);
          for (const cand of matches) {
            const originalIndex = sheetCandidates.findIndex(c => c.sbd === cand.sbd);
            rowMatches.push({ sheetName, candidate: cand, originalIndex });
          }
        }

        if (rowMatches.length === 1) {
          const { sheetName, candidate, originalIndex } = rowMatches[0];
          
          if (!autoUpdatesGrouped[sheetName]) {
            autoUpdatesGrouped[sheetName] = [...(allSheetsData.get(sheetName) || [])];
          }

          const candidatesList = autoUpdatesGrouped[sheetName];
          if (originalIndex !== -1 && candidatesList[originalIndex]) {
            const originalCand = candidatesList[originalIndex];

            candidatesList[originalIndex] = {
              ...originalCand,
              tracking_number: excelCode || originalCand.tracking_number,
              exam_status: 'Pass',
              gplx_status: 'Returned',
              has_app_and_fee: true,
              has_profile: true,
            };
            resolvedCount++;
            keysToRemove.push(key);
          }
        } else if (rowMatches.length === 0) {
          keysToRemove.push(key);
        } else {
          const alreadyResolved = rowMatches.some(m => m.candidate.tracking_number === excelCode);
          if (alreadyResolved) {
            keysToRemove.push(key);
          }
        }
      }

      for (const [sheetName, updatedList] of Object.entries(autoUpdatesGrouped)) {
        await updateCandidatesInSheet(sheetName, updatedList);
        sheetsCache.delete(`sheets_data_${sheetName}`);
        sheetsCache.delete(`sheets_data_single_${sheetName}`);
      }

      for (const key of keysToRemove) {
        await unresolvedRef.child(key).remove();
      }

      if (resolvedCount > 0) {
        sheetsCache.delete('sheets_data_all');
      }

      return NextResponse.json({
        success: true,
        message: `Làm mới hoàn tất! Đã tự động giải quyết thành công ${resolvedCount} xung đột cũ dựa trên dữ liệu Google Sheets thời gian thực!`,
        resolvedCount
      });
    }

    // TÁC VỤ 3: IMPORT & ĐỐI CHIẾU FILE EXCEL BƯU ĐIỆN CHÍNH
    const { excelData, incompleteData } = body;
    if (!excelData || !Array.isArray(excelData) || excelData.length === 0) {
      return NextResponse.json({ success: false, error: 'Dữ liệu danh sách Excel rỗng' }, { status: 400 });
    }

    const withdrawnCodesSnap = await db.ref('withdrawn_codes').once('value');
    const withdrawnCodes = withdrawnCodesSnap.val() || {};

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

      if (excelCode && withdrawnCodes[excelCode]) {
        console.log(`🚫 Bỏ qua mã hiệu bị rút: ${excelCode}`);
        continue;
      }

      const rowMatches: { sheetName: string; candidate: Candidate; originalIndex: number }[] = [];

      for (const [sheetName, sheetCandidates] of allSheetsData.entries()) {
        const matches = findMatchesInSheet(sheetCandidates, excelSbd, excelName, excelDob);
        for (const cand of matches) {
          const originalIndex = sheetCandidates.findIndex(c => c.sbd === cand.sbd);
          rowMatches.push({ sheetName, candidate: cand, originalIndex });
        }
      }

      if (rowMatches.length === 1) {
        const { sheetName, candidate, originalIndex } = rowMatches[0];
        
        if (!autoUpdatesGrouped[sheetName]) {
          autoUpdatesGrouped[sheetName] = [...(allSheetsData.get(sheetName) || [])];
        }

        const candidatesList = autoUpdatesGrouped[sheetName];
        if (originalIndex !== -1 && candidatesList[originalIndex]) {
          const originalCand = candidatesList[originalIndex];

          candidatesList[originalIndex] = {
            ...originalCand,
            tracking_number: excelCode || originalCand.tracking_number,
            exam_status: 'Pass',
            gplx_status: 'Returned',
            has_app_and_fee: true,
            has_profile: true,
          };
          autoUpdatedCount++;
        }
      } else if (rowMatches.length > 1) {
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
        unmatched.push(row);
      }
    }

    // Đồng bộ lên các Sheet
    for (const [sheetName, updatedList] of Object.entries(autoUpdatesGrouped)) {
      await updateCandidatesInSheet(sheetName, updatedList);
      sheetsCache.delete(`sheets_data_${sheetName}`);
      sheetsCache.delete(`sheets_data_single_${sheetName}`);
    }

    if (autoUpdatedCount > 0) {
      sheetsCache.delete('sheets_data_all');
    }

    // 1. Lưu bản ghi trùng khớp (Conflicts) lên Firebase
    if (conflicts.length > 0) {
      const updates: Record<string, any> = {};
      for (const conflict of conflicts) {
        const excelSbd = String(conflict.excelRow.sbd || '').trim();
        const excelName = String(conflict.excelRow.fullName || '').trim();
        const excelDob = String(conflict.excelRow.dateOfBirth || '').trim();
        
        const rawKey = `${excelSbd}_${normalizeName(excelName)}_${excelDob.replace(/[\/]/g, '-')}`;
        const safeKey = Buffer.from(rawKey).toString('base64')
          .replace(/=/g, '')
          .replace(/[\.\$\#\[\]\/]/g, '_');
        
        updates[safeKey] = {
          ...conflict,
          conflictKey: safeKey
        };
      }
      await db.ref('unresolved_conflicts').update(updates);
    }

    // 2. Lưu bản ghi không tồn tại (Unmatched) lên Firebase
    if (unmatched.length > 0) {
      const updates: Record<string, any> = {};
      for (const row of unmatched) {
        const excelSbd = String(row.sbd || '').trim();
        const excelName = String(row.fullName || row.name || '').trim();
        const excelDob = String(row.dateOfBirth || '').trim();
        
        const rawKey = `unmatched_${excelSbd}_${normalizeName(excelName)}_${excelDob.replace(/[\/]/g, '-')}_${Date.now()}`;
        const safeKey = Buffer.from(rawKey).toString('base64')
          .replace(/=/g, '')
          .replace(/[\.\$\#\[\]\/]/g, '_');

        updates[safeKey] = {
          ...row,
          unmatchedKey: safeKey
        };
      }
      await db.ref('unmatched_records').update(updates);
    }

    // 3. Lưu bản ghi thiếu thông tin (Incomplete) lên Firebase
    if (incompleteData && Array.isArray(incompleteData) && incompleteData.length > 0) {
      const updates: Record<string, any> = {};
      for (const row of incompleteData) {
        const rawText = String(row.rawText || '').trim();
        
        const rawKey = `incomplete_${normalizeName(rawText)}_${Date.now()}`;
        const safeKey = Buffer.from(rawKey).toString('base64')
          .replace(/=/g, '')
          .replace(/[\.\$\#\[\]\/]/g, '_');

        updates[safeKey] = {
          ...row,
          recordKey: safeKey
        };
      }
      await db.ref('incomplete_records').update(updates);
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