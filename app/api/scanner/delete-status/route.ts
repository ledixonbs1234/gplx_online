import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

/**
 * API xóa trạng thái của thí sinh:
 * - deleteType: 'single' (xóa 1 người), 'profile' (xóa hồ sơ), 'gplx' (xóa trạng thái GPLX)
 * - candidates: Danh sách { sbd, exam_date } cần xóa
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { candidates, deleteType } = body;

    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Không có thí sinh nào để xóa' },
        { status: 400 }
      );
    }

    let credentials;
   
    if (process.env.GOOGLE_CREDENTIALS_CONTENT) {
      try {
        credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_CONTENT);
      } catch (error) {
        return NextResponse.json(
          { success: false, error: 'Không thể parse biến môi trường GOOGLE_CREDENTIALS_CONTENT' },
          { status: 500 }
        );
      }
    } else {
      const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH || './google-credentials.json';
      try {
        const fs = require('fs');
        const path = require('path');
        const absolutePath = path.resolve(credentialsPath);
        credentials = JSON.parse(fs.readFileSync(absolutePath, 'utf-8'));
      } catch (error) {
        return NextResponse.json(
          { success: false, error: 'Không thể đọc file credentials. Hãy thiết lập biến môi trường GOOGLE_CREDENTIALS_CONTENT trên Vercel.' },
          { status: 500 }
        );
      }
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    let updatedCount = 0;

    // Xử lý từng thí sinh
    for (const candidate of candidates) {
      const { sbd, exam_date } = candidate;

      if (!sbd || !exam_date) continue;

      // Tìm sheet tương ứng với ngày thi
      const sheetName = exam_date;

      try {
        // Đọc dữ liệu hiện tại của sheet
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `'${sheetName}'!A1:Z1000`,
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) continue;

        // Dòng đầu là header
        const headers = rows[0].map((h: string) => h.toLowerCase().trim());

        // Tìm index của các cột cần thiết
        const sbdIndex = headers.findIndex(h =>
          ['sbd', 'số báo danh', 'so bao danh', 'id', 'mã hv', 'ma hv'].includes(h)
        );
        const profileIndex = headers.findIndex(h =>
          ['có hồ sơ', 'co ho so', 'has_profile'].includes(h)
        );
        const gplxIndex = headers.findIndex(h =>
          ['trạng thái gplx', 'trang thai gplx', 'gplx_status'].includes(h)
        );

        if (sbdIndex === -1) continue;

        // Tìm hàng có SBD khớp
        let rowIndex = -1;
        for (let i = 1; i < rows.length; i++) {
          if (rows[i][sbdIndex] && String(rows[i][sbdIndex]).trim() === sbd) {
            rowIndex = i + 1; // +1 vì Google Sheets đánh số từ 1
            break;
          }
        }

        if (rowIndex === -1) continue;

        // Cập nhật trạng thái
        const updates = [];

        if (deleteType === 'profile' || deleteType === 'single') {
          if (profileIndex !== -1) {
            const profileColumn = String.fromCharCode('A'.charCodeAt(0) + profileIndex);
            updates.push({
              range: `'${sheetName}'!${profileColumn}${rowIndex}`,
              values: [['Không']],
            });
          }
        }

        if (deleteType === 'gplx' || deleteType === 'single') {
          if (gplxIndex !== -1) {
            const gplxColumn = String.fromCharCode('A'.charCodeAt(0) + gplxIndex);
            updates.push({
              range: `'${sheetName}'!${gplxColumn}${rowIndex}`,
              values: [['Chờ']],
            });
          }
        }

        // Thực hiện cập nhật
        for (const update of updates) {
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: update.range,
            valueInputOption: 'RAW',
            requestBody: { values: update.values },
          });
        }

        if (updates.length > 0) {
          updatedCount++;
        }
      } catch (error: any) {
        console.error(`Error updating candidate ${sbd}:`, error);
        // Tiếp tục với thí sinh khác
      }
    }

    return NextResponse.json({
      success: true,
      message: `Đã xóa thành công ${updatedCount} thí sinh`,
      updatedCount,
    });
  } catch (error: any) {
    console.error('Error deleting status:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
