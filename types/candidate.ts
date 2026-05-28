// plx_online/types/candidate.ts
export type ExamStatus = 'Pass' | 'Fail' | 'Not_Tested';
export type GPLXStatus = 'Returned' | 'Pending';

export interface Candidate {
  sbd: string; // Số báo danh
  name: string;
  date_of_birth?: string; // Ngày sinh
  phone?: string; // Số điện thoại
  residence?: string; // Nơi cư trú
  receive_location?: string; // Nơi nhận
  tracking_number?: string; // Mã vận đơn
  exam_date: string;
  has_profile: boolean;
  exam_status: ExamStatus;
  has_app_and_fee: boolean;
  gplx_status: GPLXStatus;
}

export interface DayReport {
  date: string;
  total_candidates: number;
  no_profile_count: number;
  fail_count: number;
  pass_count: number;
  with_app_and_fee: {
    total: number;
    returned: number; // Chỉ còn ghi nhận GPLX đã về
    pending: number;
  };
  without_fee: {
    total: number;
    returned: number;
    pending: number;
  };
}