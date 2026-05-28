// plx_online/scripts/fix-exam-status.js
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Tự động nạp môi trường từ .env.local
function loadEnvLocal() {
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const envConfig = fs.readFileSync(envPath, 'utf-8');
      envConfig.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let value = match[2] || '';
          if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
            value = value.replace(/^"|"\s*$/g, '');
          }
          process.env[key] = value;
        }
      });
      console.log('✅ Đã nạp thành công biến môi trường từ file .env.local');
    }
  } catch (e) {
    console.warn('⚠️ Không thể đọc file .env.local:', e.message);
  }
}

async function run() {
  loadEnvLocal();

  console.log('🔄 Đang kết nối Google Sheets API...');

  let credentials;
  if (process.env.GOOGLE_CREDENTIALS_CONTENT) {
    credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_CONTENT);
  } else {
    const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH || './google-credentials.json';
    try {
      credentials = JSON.parse(fs.readFileSync(path.resolve(credentialsPath), 'utf-8'));
    } catch (error) {
      console.error(`❌ Không tìm thấy Google Credentials. Vui lòng kiểm tra file google-credentials.json.`);
      process.exit(1);
    }
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  if (!spreadsheetId) {
    console.error('❌ Thiếu giá trị GOOGLE_SHEET_ID trong biến môi trường!');
    process.exit(1);
  }

  console.log('📡 Đang quét toàn bộ danh sách các sheet...');
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetsList = spreadsheet.data.sheets || [];

  console.log(`📋 Phát hiện tổng cộng ${sheetsList.length} sheet trong hệ thống.`);

  for (const sheet of sheetsList) {
    const sheetTitle = sheet.properties.title;
    console.log(`--------------------------------------------------`);
    console.log(`📝 Đang chuẩn hóa sheet: "${sheetTitle}"...`);

    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheetTitle}'!A1:Z1000`,
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        console.log(`ℹ️ Sheet rỗng, bỏ qua.`);
        continue;
      }

      const headers = rows[0].map(h => String(h || '').toLowerCase().trim());
      
      const phoneHeaders = ['số điện thoại', 'so dien thoai', 'phone', 'điện thoại', 'dien thoai'];
      const examStatusHeaders = ['kết quả thi', 'ket qua thi', 'exam_status'];
      const hasAppAndFeeHeaders = ['đã nộp tiền', 'da nop tien', 'đk app + tiền', 'dk app', 'has_app_and_fee'];

      const phoneIdx = headers.findIndex(h => phoneHeaders.includes(h));
      const examStatusIdx = headers.findIndex(h => examStatusHeaders.includes(h));
      const hasAppAndFeeIdx = headers.findIndex(h => hasAppAndFeeHeaders.includes(h));

      if (phoneIdx === -1) {
        console.log(`⚠️ Không tìm thấy cột "Số điện thoại" trong sheet "${sheetTitle}". Bỏ qua.`);
        continue;
      }

      let updatedRowsCount = 0;

      // Duyệt tất cả học viên trong sheet
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        while (row.length < headers.length) {
          row.push('');
        }

        const phoneVal = row[phoneIdx] ? String(row[phoneIdx]).trim() : '';
        const cleanPhone = phoneVal.startsWith("'") ? phoneVal.slice(1) : phoneVal;

        // Nếu học viên có số điện thoại
        if (cleanPhone !== '') {
          let rowUpdated = false;

          // 1. Đồng bộ kết quả thi thành "Đậu"
          if (examStatusIdx !== -1) {
            const currentStatus = row[examStatusIdx] ? String(row[examStatusIdx]).trim() : '';
            if (currentStatus !== 'Đậu' && currentStatus !== 'Pass') {
              row[examStatusIdx] = 'Đậu';
              rowUpdated = true;
            }
          }

          // 2. Đồng bộ trạng thái nộp tiền thành "Có"
          if (hasAppAndFeeIdx !== -1) {
            const currentFeeStatus = row[hasAppAndFeeIdx] ? String(row[hasAppAndFeeIdx]).trim() : '';
            if (currentFeeStatus !== 'Có' && currentFeeStatus !== 'Đã Nộp' && currentFeeStatus !== 'Yes') {
              row[hasAppAndFeeIdx] = 'Có';
              rowUpdated = true;
            }
          }

          if (rowUpdated) {
            updatedRowsCount++;
          }
        }
      }

      if (updatedRowsCount > 0) {
        const endColumnLetter = String.fromCharCode(65 + headers.length - 1);
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `'${sheetTitle}'!A1:${endColumnLetter}${rows.length}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: rows,
          },
        });
        console.log(`✅ Chuẩn hóa hoàn tất! Đã cập nhật ${updatedRowsCount} học viên sang trạng thái: Đậu & Đã nộp tiền.`);
      } else {
        console.log(`ℹ️ Dữ liệu ngày thi này đã được đồng bộ chuẩn hóa đầy đủ.`);
      }

    } catch (error) {
      console.error(`❌ Lỗi khi xử lý sheet "${sheetTitle}":`, error.message);
    }
  }

  console.log(`==================================================`);
  console.log('🎉 Toàn bộ dữ liệu các sheet đã được chuẩn hóa Đậu & Đã nộp tiền thành công!');
}

run().catch(console.error);