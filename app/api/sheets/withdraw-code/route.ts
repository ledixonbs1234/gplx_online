// plx_online/app/api/sheets/withdraw-code/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { findSheetNameWithFallback } from '@/lib/google-sheets';
import { sheetsCache } from '@/lib/cache';
import { getAdminDb } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { examDate, sbd, trackingNumber, hasProfile, examStatus, hasAppAndFee, gplxStatus } = body;

    if (!examDate || !sbd) {
      return NextResponse.json(
        { success: false, error: 'Thiếu ngày thi hoặc Số báo danh để khôi phục' },
        { status: 400 }
      );
    }

    const db = getAdminDb();

    // 1. Thêm mã vận đơn vào Blacklist Firebase nếu có để các lần đối chiếu sau không quét lại mã này nữa
    if (trackingNumber) {
      await db.ref(`withdrawn_codes/${trackingNumber}`).set(true);
    }

    // 2. Tiến hành kết nối Google Sheets để cập nhật lại dữ liệu
    let credentials;
    if (process.env.GOOGLE_CREDENTIALS_CONTENT) {
      credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_CONTENT);
    } else {
      const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH || './google-credentials.json';
      const fs = require('fs');
      const path = require('path');
      credentials = JSON.parse(fs.readFileSync(path.resolve(credentialsPath), 'utf-8'));
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const actualSheetName = await findSheetNameWithFallback(examDate);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${actualSheetName}'!A1:Z1000`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy dữ liệu trong sheet' }, { status: 404 });
    }

    const headers = rows[0].map((h: string) => h.toLowerCase().trim());
    const getColIdx = (possibleNames: string[]) => {
      for (const name of possibleNames) {
        const idx = headers.indexOf(name.toLowerCase());
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const sbdIdx = getColIdx(['sbd', 'số báo danh', 'so bao danh', 'id', 'mã hv', 'ma hv']);
    if (sbdIdx === -1) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy cột Số báo danh trong Sheet' }, { status: 400 });
    }

    // Tìm kiếm dòng học viên khớp SBD
    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      let cellSbd = rows[i][sbdIdx] ? String(rows[i][sbdIdx]).trim() : '';
      if (cellSbd.startsWith("'")) {
        cellSbd = cellSbd.slice(1);
      }
      if (cellSbd === String(sbd).trim()) {
        rowIndex = i;
        break;
      }
    }

    if (rowIndex === -1) {
      return NextResponse.json({ success: false, error: `Không tìm thấy SBD ${sbd} trong ngày thi ${examDate}` }, { status: 404 });
    }

    const rowData = [...rows[rowIndex]];
    while (rowData.length < headers.length) {
      rowData.push('');
    }

    const profileIdx = getColIdx(['có hồ sơ', 'co ho so', 'has_profile']);
    const examStatusIdx = getColIdx(['kết quả thi', 'ket qua thi', 'exam_status']);
    const hasAppAndFeeIdx = getColIdx(['đã nộp tiền', 'da nop tien', 'đk app + tiền', 'dk app', 'has_app_and_fee']);
    const gplxStatusIdx = getColIdx(['trạng thái gplx', 'trang thai gplx', 'gplx_status']);
    const trackingIdx = getColIdx(['mã vận đơn', 'ma van don', 'tracking_number', 'tracking']);

    // Cập nhật trạng thái trực tiếp theo lựa chọn của người dùng từ giao diện
    if (profileIdx !== -1 && hasProfile !== undefined) {
      rowData[profileIdx] = hasProfile ? 'Có' : 'Không';
    }
    if (examStatusIdx !== -1 && examStatus !== undefined) {
      rowData[examStatusIdx] = examStatus === 'Pass' ? 'Đậu' : examStatus === 'Fail' ? 'Rớt' : 'Chưa thi';
    }
    if (hasAppAndFeeIdx !== -1 && hasAppAndFee !== undefined) {
      rowData[hasAppAndFeeIdx] = hasAppAndFee ? 'Có' : 'Không';
    }
    if (gplxStatusIdx !== -1 && gplxStatus !== undefined) {
      rowData[gplxStatusIdx] = gplxStatus === 'Returned' ? 'Đã về' : 'Chờ';
    }
    if (trackingIdx !== -1) {
      rowData[trackingIdx] = ''; // Luôn xóa sạch mã vận đơn khi bưu gửi bị rút
    }

    const rowNum = rowIndex + 1;
    const maxColLetter = String.fromCharCode(65 + Math.min(25, headers.length - 1));

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${actualSheetName}'!A${rowNum}:${maxColLetter}${rowNum}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [rowData],
      },
    });

    // Dọn dẹp bản backup cũ trên Firebase Database nếu có
    await db.ref(`candidate_backup/${examDate}/${sbd}`).remove();

    // Làm mới Cache
    sheetsCache.delete(`sheets_data_${examDate}`);
    sheetsCache.delete(`sheets_data_single_${examDate}`);
    sheetsCache.delete('sheets_data_all');

    return NextResponse.json({
      success: true,
      message: `Đã cập nhật bưu rút thành công cho học viên SBD ${sbd} và loại trừ mã vận đơn ${trackingNumber}.`
    });

  } catch (error: any) {
    console.error('Lỗi API rút bưu gửi:', error);
    return NextResponse.json({ success: false, error: error.message || 'Lỗi xử lý hệ thống' }, { status: 500 });
  }
}