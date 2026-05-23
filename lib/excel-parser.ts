import * as XLSX from 'xlsx';
import { Candidate } from '@/types/candidate';

export function parseExcelFile(fileBuffer: Buffer): Map<string, Candidate[]> {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const candidatesByDate = new Map<string, Candidate[]>();

  workbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet);

    const candidates: Candidate[] = rawData.map((row: any, index: number) => ({
      id: row['ID'] || row['Mã HV'] || `HV${String(index + 1).padStart(3, '0')}`,
      name: row['Họ tên'] || row['Name'] || '',
      exam_date: sheetName,
      has_profile: parseBoolean(row['Có hồ sơ'] || row['has_profile']),
      exam_status: parseExamStatus(row['Kết quả thi'] || row['exam_status']),
      has_app_and_fee: parseBoolean(row['Đã Nộp Tiền'] || row['has_app_and_fee']),
      gplx_status: parseGPLXStatus(row['Trạng thái GPLX'] || row['gplx_status']),
      has_postal_up: parseBoolean(row['Up postal'] || row['has_postal_up']),
    }));

    candidatesByDate.set(sheetName, candidates);
  });

  return candidatesByDate;
}

function parseBoolean(value: any): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    return lower === 'true' || lower === 'có' || lower === 'yes' || lower === '1';
  }
  return Boolean(value);
}

function parseExamStatus(value: any): 'Pass' | 'Fail' | 'Not_Tested' {
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    if (lower.includes('đậu') || lower.includes('pass') || lower === 'true') return 'Pass';
    if (lower.includes('rớt') || lower.includes('fail') || lower === 'false') return 'Fail';
  }
  return 'Not_Tested';
}

function parseGPLXStatus(value: any): 'Returned' | 'Pending' {
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    if (lower.includes('về') || lower.includes('returned')) return 'Returned';
    if (lower.includes('chưa') || lower.includes('pending')) return 'Pending';
  }
  return 'Pending';
}