// plx_online/lib/google-sheets.ts
import { google } from 'googleapis';
import { Candidate } from '@/types/candidate';

// Singleton pattern để tránh tạo nhiều auth instance
let sheetsClient: any = null;

// Khởi tạo các biến lưu trữ bộ nhớ đệm RAM (In-Memory Cache) cho tên Sheet
let cachedSheetNames: string[] | null = null;
let cachedSheetNamesTimestamp = 0;
const CACHE_TTL = 3 * 60 * 1000; // Thời gian sống của cache: 3 phút (3 * 60 * 1000ms)

function getSheetsClient() {
  if (sheetsClient) return sheetsClient;

  let credentials;
  if (process.env.GOOGLE_CREDENTIALS_CONTENT) {
    try {
      credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_CONTENT);
    } catch (error) {
      throw new Error('Không thể parse biến môi trường GOOGLE_CREDENTIALS_CONTENT. Đảm bảo nội dung là JSON hợp lệ.');
    }
  } else {
    const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH || './google-credentials.json';
    try {
      const fs = require('fs');
      const path = require('path');
      const absolutePath = path.resolve(credentialsPath);
      credentials = JSON.parse(fs.readFileSync(absolutePath, 'utf-8'));
    } catch (error) {
      throw new Error(`Không thể đọc file credentials tại: ${credentialsPath}.`);
    }
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  });

  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

/**
 * Hàm trợ giúp tự động thêm tiền tố nháy đơn để Google Sheets hiểu là chữ
 */
function formatAsTextValue(val: string | number | undefined): string {
  if (val === undefined || val === null) return '';
  const str = String(val).trim();
  if (str === '') return '';
  if (str.startsWith("'")) return str;
  return `'${str}`;
}

/**
 * Xóa bộ nhớ đệm danh sách tên sheet khi có thay đổi (ví dụ: tạo sheet mới)
 */
export function clearSheetNamesCache() {
  cachedSheetNames = null;
  cachedSheetNamesTimestamp = 0;
  console.log('🗑️ [Cache] Đã xóa bộ nhớ đệm danh sách tên Sheet');
}

/**
 * Kiểm tra xem chuỗi có phải là định dạng ngày hợp lệ không (dd-MM-yyyy hoặc yyyy-MM-dd)
 */
export function isValidDateSheetName(name: string): boolean {
  const ddMMyyyyRegex = /^\d{2}-\d{2}-\d{4}$/;
  const yyyyMMddRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (!ddMMyyyyRegex.test(name) && !yyyyMMddRegex.test(name)) {
    return false;
  }

  const parts = name.split('-');
  let day: number, month: number, year: number;

  if (parts[0].length === 4) {
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    day = parseInt(parts[2], 10);
  } else {
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    year = parseInt(parts[2], 10);
  }

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (year < 1900 || year > 2100) return false;

  const daysInMonth = new Date(year, month, 0).getDate();
  if (day > daysInMonth) return false;

  return true;
}

/**
 * Lấy danh sách tất cả các Sheet (Sử dụng RAM Cache để tránh vượt định mức Quota Google)
 */
export async function getAllSheetNames(forceRefresh = false): Promise<string[]> {
  const now = Date.now();
  
  if (!forceRefresh && cachedSheetNames && (now - cachedSheetNamesTimestamp < CACHE_TTL)) {
    console.log('⚡ [RAM Cache] Sử dụng danh sách tên sheet lưu trong bộ nhớ');
    return cachedSheetNames;
  }

  console.log('📡 [Google API] Đang gửi yêu cầu spreadsheets.get lấy danh sách tên sheet mới...');
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  const response = await sheets.spreadsheets.get({
    spreadsheetId,
  });

  const allSheets = response.data.sheets?.map((sheet: any) => sheet.properties.title) || [];
  const validDateSheets = allSheets.filter((name: string) => isValidDateSheetName(name));

  cachedSheetNames = validDateSheets;
  cachedSheetNamesTimestamp = now;

  return validDateSheets;
}

/**
 * Tìm tên sheet thực tế hỗ trợ chuyển đổi linh hoạt giữa dd-MM-yyyy và yyyy-MM-dd
 */
export async function findSheetNameWithFallback(requestedName: string): Promise<string> {
  try {
    const existingSheets = await getAllSheetNames();
    if (existingSheets.includes(requestedName)) {
      return requestedName;
    }

    const parts = requestedName.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        const altName = `${parts[2]}-${parts[1]}-${parts[0]}`;
        if (existingSheets.includes(altName)) {
          return altName;
        }
      } else if (parts[2].length === 4) {
        const altName = `${parts[2]}-${parts[1]}-${parts[0]}`;
        if (existingSheets.includes(altName)) {
          return altName;
        }
      }
    }
  } catch (error) {
    console.error('Error finding sheet fallback name:', error);
  }
  return requestedName;
}

/**
 * Đọc dữ liệu từ một sheet cụ thể
 */
export async function readSheet(sheetName: string): Promise<Candidate[]> {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  const actualSheetName = await findSheetNameWithFallback(sheetName);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${actualSheetName}'!A1:Z1000`,
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) return [];

  const headers = rows[0].map((h: string) => h.toLowerCase().trim());
  const dataRows = rows.slice(1);

  return dataRows.map((row: any[], index: number) => ({
    sbd: getCellValue(row, headers, ['sbd', 'số báo danh', 'so bao danh', 'id', 'mã hv', 'ma hv']) || `HV${String(index + 1).padStart(4, '0')}`,
    name: getCellValue(row, headers, ['họ tên', 'ho ten', 'name', 'tên']) || '',
    date_of_birth: getCellValue(row, headers, ['ngày sinh', 'ngay sinh', 'date of birth', 'dob', 'birth date']) || undefined,
    phone: getCellValue(row, headers, ['số điện thoại', 'so dien thoai', 'phone', 'điện thoại', 'dien thoai']) || undefined,
    residence: getCellValue(row, headers, ['nơi cư trú', 'noi cu tru', 'residence', 'địa chỉ', 'dia chi']) || undefined,
    receive_location: getCellValue(row, headers, ['nơi nhận', 'noi nhan', 'receive_location']) || undefined,
    tracking_number: getCellValue(row, headers, ['mã vận đơn', 'ma van don', 'tracking_number', 'tracking']) || undefined,
    exam_date: actualSheetName,
    has_profile: parseBool(getCellValue(row, headers, ['có hồ sơ', 'co ho so', 'has_profile'])),
    exam_status: parseExamStatus(getCellValue(row, headers, ['kết quả thi', 'ket qua thi', 'exam_status'])),
    has_app_and_fee: parseBool(getCellValue(row, headers, ['đã nộp tiền', 'da nop tien', 'đk app + tiền', 'dk app', 'has_app_and_fee'])),
    gplx_status: parseGPLXStatus(getCellValue(row, headers, ['trạng thái gplx', 'trang thai gplx', 'gplx_status'])),
    has_postal_up: parseBool(getCellValue(row, headers, ['đã up portal', 'da up portal', 'up portal', 'đã up', 'da up', 'up postal', 'has_postal_up'])),
  }));
}

/**
 * Đọc tất cả các sheet và trả về Map
 */
export async function readAllSheets(): Promise<Map<string, Candidate[]>> {
  const sheetNames = await getAllSheetNames();
  const result = new Map<string, Candidate[]>();

  const promises = sheetNames.map(async (name) => {
    try {
      const candidates = await readSheet(name);
      return { name, candidates };
    } catch (error) {
      console.error(`Lỗi đọc sheet ${name}:`, error);
      return { name, candidates: [] };
    }
  });

  const results = await Promise.all(promises);
  results.forEach(({ name, candidates }) => {
    if (candidates.length > 0) {
      result.set(name, candidates);
    }
  });

  return result;
}

/**
 * Tạo sheet mới cho ngày thi (Thiết lập tự động định dạng Văn bản cho SBD và SĐT)
 */
export async function createNewSheet(sheetName: string): Promise<void> {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  // 1. Tạo sheet mới
  const response = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: sheetName,
            },
          },
        },
      ],
    },
  });

  const sheetId = response.data.replies?.[0]?.addSheet?.properties?.sheetId;

  // 2. Tự động định dạng Cột A (SBD - index 0) và Cột D (SĐT - index 3) thành Văn bản thuần (TEXT)
  if (sheetId !== undefined && sheetId !== null) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: sheetId,
                startColumnIndex: 0,
                endColumnIndex: 1, // Cột A (SBD)
              },
              cell: {
                userEnteredFormat: {
                  numberFormat: {
                    type: 'TEXT',
                  },
                },
              },
              fields: 'userEnteredFormat.numberFormat',
            },
          },
          {
            repeatCell: {
              range: {
                sheetId: sheetId,
                startColumnIndex: 3,
                endColumnIndex: 4, // Cột D (Số Điện thoại)
              },
              cell: {
                userEnteredFormat: {
                  numberFormat: {
                    type: 'TEXT',
                  },
                },
              },
              fields: 'userEnteredFormat.numberFormat',
            },
          },
        ],
      },
    });
  }

  // 3. Ghi dữ liệu tiêu đề chính
  const headers = [
    ['SBD', 'Họ tên', 'Ngày Sinh', 'Số Điện Thoại', 'Nơi cư trú', 'Nơi Nhận', 'Mã Vận Đơn', 'Có hồ sơ', 'Kết quả thi', 'Đã Nộp Tiền', 'Trạng thái GPLX', 'Đã Up Portal'],
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${sheetName}'!A1:L1`,
    valueInputOption: 'RAW',
    requestBody: { values: headers },
  });

  clearSheetNamesCache();
}

/**
 * Ghi dữ liệu vào một sheet cụ thể
 */
export async function writeToSheet(sheetName: string, candidates: Candidate[]): Promise<void> {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  const actualSheetName = await findSheetNameWithFallback(sheetName);

  const values = candidates.map((c) => [
    formatAsTextValue(c.sbd),
    c.name,
    c.date_of_birth || '',
    formatAsTextValue(c.phone),
    c.residence || '',
    c.receive_location || '',
    c.tracking_number || '',
    c.has_profile ? 'Có' : 'Không',
    c.exam_status,
    c.has_app_and_fee ? 'Có' : 'Không',
    c.gplx_status,
    c.has_postal_up ? 'Có' : 'Không',
  ]);

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${actualSheetName}'!A2:L${values.length + 1}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}

/**
 * Cập nhật danh sách thí sinh vào sheet (ghi đè toàn bộ dữ liệu)
 */
export async function updateCandidatesInSheet(sheetName: string, candidates: Candidate[]): Promise<void> {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  const actualSheetName = await findSheetNameWithFallback(sheetName);
  const lastRow = candidates.length + 1;

  const values = candidates.map((c) => [
    formatAsTextValue(c.sbd),
    c.name,
    c.date_of_birth || '',
    formatAsTextValue(c.phone),
    c.residence || '',
    c.receive_location || '',
    c.tracking_number || '',
    c.has_profile ? 'Có' : 'Không',
    c.exam_status === 'Pass' ? 'Đậu' : c.exam_status === 'Fail' ? 'Rớt' : 'Chưa thi',
    c.has_app_and_fee ? 'Có' : 'Không',
    c.gplx_status === 'Returned' ? 'Đã về' : 'Chờ',
    c.has_postal_up ? 'Có' : 'Không',
  ]);

  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `'${actualSheetName}'!A2:L1000`,
  });

  if (values.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${actualSheetName}'!A2:L${lastRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });
  }
}

// Helper functions
function getCellValue(row: any[], headers: string[], possibleNames: string[]): string {
  for (const name of possibleNames) {
    const index = headers.indexOf(name.toLowerCase());
    if (index !== -1 && row[index] !== undefined) {
      let val = String(row[index]).trim();
      // Loại bỏ dấu nháy đơn nếu tồn tại để xử lý dữ liệu sạch trong app
      if (val.startsWith("'")) {
        val = val.slice(1);
      }
      return val;
    }
  }
  return '';
}

function parseBool(value: string): boolean {
  if (!value) return false;
  const lower = value.toLowerCase();
  return ['có', 'co', 'yes', 'true', '1'].includes(lower);
}

function parseExamStatus(value: string): 'Pass' | 'Fail' | 'Not_Tested' {
  if (!value) return 'Not_Tested';
  const lower = value.toLowerCase();
  if (lower.includes('đậu') || lower.includes('dau') || lower.includes('pass')) return 'Pass';
  if (lower.includes('rớt') || lower.includes('rot') || lower.includes('fail')) return 'Fail';
  return 'Not_Tested';
}

function parseGPLXStatus(value: string): 'Returned' | 'Pending' {
  if (!value) return 'Pending';
  const lower = value.toLowerCase();
  if (lower.includes('về') || lower.includes('ve') || lower.includes('returned')) return 'Returned';
  return 'Pending';
}