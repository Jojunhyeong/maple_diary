// ===== 기본 사용자 관련 타입 =====

export interface LocalOwner {
  local_owner_id: string;  // UUID
  created_at: string;      // ISO 8601
}

export interface UserProfile {
  id?: string;
  character_name: string;
  character_ocid?: string;
  class: string;
  level: number;
  image_url?: string;
  profile_set_at: string;
}

export interface UserSettings {
  shard_price: number;
  shard_price_updated_at?: string;
  timezone?: string;
}

export interface UserGoals {
  current_month: string;  // "2026-04"
  meso_goal?: number;
  shard_goal?: number;
  time_goal_minutes?: number;
}

export interface AuthUser {
  id: string;
  email?: string;
  kakao_id?: string;
  character_name?: string;
}

// ===== 기록 관련 타입 =====

export type SyncStatus = "local" | "pending" | "synced" | "error";

export interface Record {
  id: string;  // UUID
  local_owner_id?: string;
  user_id?: string;  // 서버 저장 시
  date: string;      // YYYY-MM-DD
  time_minutes: number;
  meso: number;
  shard_count: number;
  material_cost: number;
  memo?: string;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
  local_id?: string;  // 마이그레이션용
}

export interface RecordWithCalculations extends Record {
  shard_value: number;
  total_revenue: number;
  net_revenue: number;
  meso_per_hour: number;
  net_per_hour: number;
  shard_per_hour: number;
}

// ===== 분석 관련 타입 =====

export interface DailyStats {
  date: string;
  record_count: number;
  total_revenue: number;
  average_revenue: number;
  total_time_minutes: number;
  total_shards: number;
}

export interface PeriodStats {
  period: "week" | "month" | "all";
  total_revenue: number;
  average_revenue: number;
  record_count: number;
  total_time_minutes: number;
  total_shards: number;
  average_time_minutes: number;
  max_record: {
    net_revenue: number;
    date: string;
  };
  min_record: {
    net_revenue: number;
    date: string;
  };
  trend: number;
  trend_direction: "up" | "down" | "stable";
}

// ===== 목표 관련 타입 =====

export interface Goal {
  id: string;
  user_id?: string;
  local_owner_id?: string;
  month: string;     // "2026-04"
  meso_goal?: number;
  shard_goal?: number;
  time_goal_minutes?: number;
  created_at: string;
  updated_at?: string;
}

export interface GoalProgress {
  goal: Goal;
  meso_progress?: {
    current: number;
    goal: number;
    percentage: number;
    remaining: number;
    expected_date?: string;
  };
  shard_progress?: {
    current: number;
    goal: number;
    percentage: number;
    remaining: number;
    expected_date?: string;
  };
  time_progress?: {
    current: number;  // minutes
    goal: number;
    percentage: number;
    remaining: number;
    expected_date?: string;
  };
}
