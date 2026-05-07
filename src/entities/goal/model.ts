// Goal entity model
export interface Goal {
  id: string;
  user_id: string;
  month: string;
  meso_goal?: number;
  shard_goal?: number;
  time_goal_minutes?: number;
  targets?: GoalTarget[];
  created_at: string;
  updated_at: string;
}

export type GoalTargetKind = 'equipment' | 'meso';

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
