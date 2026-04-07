// Goal entity model
export interface Goal {
  id: string;
  user_id: string;
  month: string;
  meso_goal?: number;
  shard_goal?: number;
  time_goal_minutes?: number;
  created_at: string;
  updated_at: string;
}