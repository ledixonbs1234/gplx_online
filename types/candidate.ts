export type ExamStatus = 'Pass' | 'Fail' | 'Not_Tested';
export type GPLXStatus = 'Returned' | 'Pending';

export interface Candidate {
  id: string;
  name: string;
  exam_date: string;
  has_profile: boolean;
  exam_status: ExamStatus;
  has_app_and_fee: boolean;
  gplx_status: GPLXStatus;
  has_postal_up?: boolean;
}

export interface DayReport {
  date: string;
  total_candidates: number;
  no_profile_count: number;
  fail_count: number;
  pass_count: number;
  with_app_and_fee: {
    total: number;
    returned_with_postal: number;
    pending: number;
  };
  without_fee: {
    total: number;
    returned: number;
    pending: number;
  };
}