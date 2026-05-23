const XLSX = require('xlsx');

const firstNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ'];
const middleNames = ['Văn', 'Thị', 'Hữu', 'Minh', 'Thanh', 'Anh', 'Đức', 'Quang', 'Tuấn', 'Hùng'];
const lastNames = ['An', 'Bình', 'Cường', 'Dung', 'Em', 'Phúc', 'Giang', 'Hương', 'Khoa', 'Linh'];

function generateName() {
  const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
  const mn = middleNames[Math.floor(Math.random() * middleNames.length)];
  const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
  return `${fn} ${mn} ${ln}`;
}

function generateCandidates(count) {
  const candidates = [];
  for (let i = 0; i < count; i++) {
    const hasProfile = Math.random() > 0.2; // 80% có hồ sơ
    const examStatus = hasProfile ? (Math.random() > 0.1 ? 'Đậu' : 'Rớt') : 'Rớt';
    const hasAppAndFee = hasProfile && examStatus === 'Đậu' ? Math.random() > 0.25 : false;
    const gplxStatus = examStatus === 'Đậu' ? (Math.random() > 0.3 ? 'Về' : 'Chưa') : 'Chưa';
    const hasPostalUp = hasAppAndFee && gplxStatus === 'Về' ? Math.random() > 0.2 : false;

    candidates.push({
      'ID': `HV${String(i + 1).padStart(4, '0')}`,
      'Họ tên': generateName(),
      'Có hồ sơ': hasProfile ? 'Có' : 'Không',
      'Kết quả thi': examStatus,
      'ĐK app + tiền': hasAppAndFee ? 'Có' : 'Không',
      'Trạng thái GPLX': gplxStatus,
      'Up postal': hasPostalUp ? 'Có' : 'Không',
    });
  }
  return candidates;
}

const wb = XLSX.utils.book_new();

// Sheet ngày 22/05
const data1 = generateCandidates(500);
const ws1 = XLSX.utils.json_to_sheet(data1);
XLSX.utils.book_append_sheet(wb, ws1, '2026-05-22');

// Sheet ngày 23/05
const data2 = generateCandidates(450);
const ws2 = XLSX.utils.json_to_sheet(data2);
XLSX.utils.book_append_sheet(wb, ws2, '2026-05-23');

// Sheet ngày 24/05
const data3 = generateCandidates(480);
const ws3 = XLSX.utils.json_to_sheet(data3);
XLSX.utils.book_append_sheet(wb, ws3, '2026-05-24');

XLSX.writeFile(wb, 'test-data.xlsx');
console.log('✅ Đã tạo file test-data.xlsx thành công!');