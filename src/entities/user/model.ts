// User entity model
export interface User {
  id: string;
  auth_id: string;
  local_owner_id?: string;
  character_name: string;
  character_ocid?: string;
  class: string;
  level: number;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  shard_price: number;
  shard_price_updated_at: string;
  timezone: string;
}