// Record entity model
export interface Record {
  id: string;
  user_id?: string;
  local_owner_id?: string;
  date: string;
  time_minutes: number;
  meso: number;
  shard_count: number;
  material_cost: number;
  memo?: string;
  created_at: string;
  updated_at: string;
  sync_status: 'local' | 'pending' | 'synced' | 'error';
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