// plx_online/app/api/sheets/update-candidate/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { findSheetNameWithFallback } from '@/lib/google-sheets';
import { sheetsCache } from '@/lib/cache';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { examDate, sbd, phone, residence } = body;

    if (!examDate || !sbd) {
      return NextResponse.json(
        { success: false, error: 'Thiếu ngày thi hoặc Số báo danh' },
        { status: 400 }
      );
    }

    // Khởi tạo Google Sheets Client
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

    // Đọc sheet hiện tại để lấy cấu trúc cột
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

    // Tìm kiếm chính xác dòng của thí sinh theo SBD (===) và xử lý loại bỏ dấu nháy đơn
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

    // Xác định cột SĐT và Địa chỉ
    const phoneIdx = getColIdx(['số điện thoại', 'so dien thoai', 'phone', 'điện thoại', 'dien thoai']);
    const residenceIdx = getColIdx(['nơi cư trú', 'noi cu tru', 'residence', 'địa chỉ', 'dia chi']);
    const receiveLocationIdx = getColIdx(['nơi nhận', 'noi nhan', 'receive_location']);

    // Cập nhật giá trị mới vào dòng dữ liệu và tự động thêm tiền tố nháy đơn
    if (phoneIdx !== -1) {
      const phoneVal = phone ? String(phone).trim() : '';
      if (phoneVal) {
        rowData[phoneIdx] = phoneVal.startsWith("'") ? phoneVal : `'${phoneVal}`;
      } else {
        rowData[phoneIdx] = '';
      }
    }
    // if (residenceIdx !== -1) rowData[residenceIdx] = residence || '';
    if (receiveLocationIdx !== -1) rowData[receiveLocationIdx] = residence || '';

    // Đồng bộ đảm bảo SBD dòng này cũng giữ nguyên tiền tố nháy đơn
    if (sbdIdx !== -1 && rowData[sbdIdx]) {
      const sbdVal = String(rowData[sbdIdx]).trim();
      if (sbdVal && !sbdVal.startsWith("'")) {
        rowData[sbdIdx] = `'${sbdVal}`;
      }
    }

    const rowNum = rowIndex + 1;
    const maxColLetter = String.fromCharCode(65 + Math.min(25, headers.length - 1));

    // Thực hiện lưu lên Google Sheets với chế độ USER_ENTERED
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${actualSheetName}'!A${rowNum}:${maxColLetter}${rowNum}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [rowData],
      },
    });
// Xóa cache của ngày thi này để cập nhật dữ liệu hiển thị tức thì trên Dashboard và Candidates Page
    sheetsCache.delete(`sheets_data_${examDate}`);
    sheetsCache.delete(`sheets_data_single_${examDate}`);
    sheetsCache.delete('sheets_data_all');

    return NextResponse.json({ success: true, message: 'Cập nhật trực tiếp thành công' });

  } catch (error: any) {
    console.error('Update Candidate API Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Lỗi kết nối bưu điện/bảng tính' }, { status: 500 });
  }
}