import { google } from 'googleapis';
import { Candidate } from '@/types/candidate';
import * as fs from 'fs';
import * as path from 'path';

// Singleton pattern để tránh tạo nhiều auth instance
let sheetsClient: any = null;

function getSheetsClient() {
  if (sheetsClient) return sheetsClient;

  const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH || './google-credentials.json';
  
  // Đọc file credentials
  let credentials;
  try {
    const absolutePath = path.resolve(credentialsPath);
    credentials = JSON.parse(fs.readFileSync(absolutePath, 'utf-8'));
  } catch (error) {
    throw new Error(`Không thể đọc file credentials tại: ${credentialsPath}. 
    Hãy đảm bảo file google-credentials.json tồn tại.`);
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
 * Lấy danh sách tất cả các Sheet (mỗi sheet = 1 ngày thi)
 */
export async function getAllSheetNames(): Promise<string[]> {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  const response = await sheets.spreadsheets.get({
    spreadsheetId,
  });

  return response.data.sheets?.map((sheet: any) => sheet.properties.title) || [];
}

/**
 * Đọc dữ liệu từ một sheet cụ thể
 */
export async function readSheet(sheetName: string): Promise<Candidate[]> {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetName}'!A1:Z1000`,
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) return [];

  // Dòng đầu là header
  const headers = rows[0].map((h: string) => h.toLowerCase().trim());
  const dataRows = rows.slice(1);

  return dataRows.map((row: any[], index: number) => ({
    sbd: getCellValue(row, headers, ['sbd', 'số báo danh', 'so bao danh', 'id', 'mã hv', 'ma hv']) || `HV${String(index + 1).padStart(4, '0')}`,
    name: getCellValue(row, headers, ['họ tên', 'ho ten', 'name', 'tên']) || '',
    date_of_birth: getCellValue(row, headers, ['ngày sinh', 'ngay sinh', 'date of birth', 'dob', 'birth date']) || undefined,
    phone: getCellValue(row, headers, ['số điện thoại', 'so dien thoai', 'phone', 'điện thoại', 'dien thoai']) || undefined,
    receive_location: getCellValue(row, headers, ['nơi nhận', 'noi nhan', 'receive_location']) || undefined,
    tracking_number: getCellValue(row, headers, ['mã vận đơn', 'ma van don', 'tracking_number', 'tracking']) || undefined,
    exam_date: sheetName,
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

  // Đọc song song để tăng tốc
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
 * Tạo sheet mới cho ngày thi
 */
export async function createNewSheet(sheetName: string): Promise<void> {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  // Tạo sheet mới
  await sheets.spreadsheets.batchUpdate({
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

  // Thêm header mới với đầy đủ các trường
  const headers = [
    ['SBD', 'Họ tên', 'Ngày Sinh', 'Số Điện Thoại', 'Nơi Nhận', 'Mã Vận Đơn', 'Có hồ sơ', 'Kết quả thi', 'Đã Nộp Tiền', 'Trạng thái GPLX', 'Đã Up Portal'],
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${sheetName}'!A1:K1`,
    valueInputOption: 'RAW',
    requestBody: { values: headers },
  });
}

/**
 * Ghi dữ liệu vào một sheet
 */
export async function writeToSheet(sheetName: string, candidates: Candidate[]): Promise<void> {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  const values = candidates.map((c) => [
    c.sbd,
    c.name,
    c.date_of_birth || '',
    c.phone || '',
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
    range: `'${sheetName}'!A2:K${values.length + 1}`,
    valueInputOption: 'RAW',
    requestBody: { values },
  });
}

// Helper functions
function getCellValue(row: any[], headers: string[], possibleNames: string[]): string {
  for (const name of possibleNames) {
    const index = headers.indexOf(name.toLowerCase());
    if (index !== -1 && row[index] !== undefined) {
      return String(row[index]).trim();
    }
  }
  return '';
}

function parseBool(value: string): boolean {
  if (!value) return false;
  const lower = value.toLowerCase();
  return ['có', 'co', 'yes', 'true', '1', 'có'].includes(lower);
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