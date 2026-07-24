export interface Shift {
  id: number;
  employee_id: number;
  employee_name: string;
  role_required: string;
  start_time: string;
  end_time: string;
  status: string;
}

export interface ShiftsResponse {
  page: number;
  limit: number;
  total_count: number;
  total_pages: number;
  shifts: Shift[];
}

export interface Employee {
  id: number;
  name: string;
  email: string;
  role: string;
  max_weekly_hours: string;
}

export interface EmployeesResponse {
  count: number;
  employees: Employee[];
}

export interface SwapRequest {
  id: number;
  shift_id: number;
  requesting_employee_id: number;
  reason: string | null;
  status: string;
  created_at: string;
}

export interface OpenSwapListItem {
  id: number;
  shift_id: number;
  requesting_employee_id: number;
  requesting_employee_name: string;
  reason: string | null;
  status: string;
  created_at: string;
  role_required: string;
  start_time: string;
  end_time: string;
}

export interface OpenSwapsResponse {
  count: number;
  swap_requests: OpenSwapListItem[];
}

export interface ClaimValidation {
  valid: boolean;
  reasons: string[];
}

export interface ClaimResult {
  swap_claim: {
    id: number;
    swap_request_id: number;
    claiming_employee_id: number;
    validated: boolean;
    conflict_reason: string | null;
    created_at: string;
  };
  validation: ClaimValidation;
}