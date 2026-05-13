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

export interface CharacterProfile {
  id: string;
  user_id?: string;
  local_owner_id?: string;
  character_name: string;
  character_ocid?: string | null;
  class: string;
  level: number;
  image_url?: string | null;
  character_world?: string | null;
  character_exp_rate?: number | string | null;
  character_combat_power?: number | null;
  character_exp_history?: CharacterExpHistoryEntry[] | null;
  is_active?: boolean;
  source?: "legacy_profile" | "manual" | "api";
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  shard_price: number;
  shard_price_updated_at?: string;
  timezone?: string;
}

export interface UserGoals {
  current_month: string;  // legacy/compat only
  meso_goal?: number;
  shard_goal?: number;
  time_goal_minutes?: number;
  targets?: GoalTarget[];
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
  character_id?: string;
  user_id?: string;  // 서버 저장 시
  date: string;      // YYYY-MM-DD
  time_minutes: number;
  meso: number;
  shard_count: number;
  exp_gain_percent: number;
  material_cost: number;
  memo?: string;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
  local_id?: string;  // 마이그레이션용
}

export interface Expense {
  id: string;
  local_owner_id?: string;
  user_id?: string;
  date: string;
  title: string;
  amount: number;
  category?: string;
  memo?: string;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
  local_id?: string;
}

export interface RecordWithCalculations extends Record {
  shard_value: number;
  total_revenue: number;
  net_revenue: number;
  meso_per_hour: number;
  net_per_hour: number;
  shard_per_hour: number;
}

export interface CharacterExpHistoryEntry {
  date: string;
  exp_gain_percent: number;
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
  month?: string;    // legacy/compat only
  position?: number;
  meso_goal?: number;
  shard_goal?: number;
  time_goal_minutes?: number;
  targets?: GoalTarget[];
  created_at: string;
  updated_at?: string;
}

export type GoalTargetKind = "equipment" | "meso";

export interface GoalTarget {
  id: string;
  kind: GoalTargetKind;
  title: string;
  target_amount: number;
  equipment_name?: string | null;
  equipment_slot?: string | null;
  equipment_icon_url?: string | null;
  equipment_shape_icon_url?: string | null;
  equipment_part?: string | null;
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
