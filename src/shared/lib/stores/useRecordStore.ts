import { create } from "zustand";
import { Record, RecordWithCalculations } from "@/shared/types";
import { saveRecord, getRecordsByOwner, deleteRecord as deleteLocalRecord } from "@/shared/lib/db/local";
import { enrichRecordWithCalculations } from "@/shared/lib/utils/calculations";

interface RecordStore {
  records: RecordWithCalculations[];
  loading: boolean;
  error: string | null;

  loadRecords: (localOwnerId: string, isLoggedIn?: boolean) => Promise<void>;
  addRecord: (
    record: Omit<Record, "id" | "created_at" | "updated_at">,
    localOwnerId: string,
    shardPrice: number,
    isLoggedIn?: boolean
  ) => Promise<void>;
  deleteRecord: (id: string, isLoggedIn?: boolean) => Promise<void>;
  clearError: () => void;
}

function getShardPrice() {
  return JSON.parse(localStorage.getItem("maple_diary:settings") || "{}").shard_price || 7_000_000;
}

export const useRecordStore = create<RecordStore>((set) => ({
  records: [],
  loading: false,
  error: null,

  loadRecords: async (localOwnerId, isLoggedIn = false) => {
    set({ loading: true });
    try {
      const shardPrice = getShardPrice();

      if (isLoggedIn) {
        // 서버에서 로드
        const res = await fetch('/api/records');
        if (!res.ok) throw new Error('서버에서 기록을 불러오지 못했습니다');
        const rawRecords = await res.json();
        const enriched = rawRecords.map((r: Record) => enrichRecordWithCalculations(r, shardPrice));
        set({ records: enriched, loading: false, error: null });
      } else {
        // 로컬에서 로드
        const rawRecords = await getRecordsByOwner(localOwnerId);
        const enriched = rawRecords.map((r) => enrichRecordWithCalculations(r, shardPrice));
        set({ records: enriched, loading: false, error: null });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "불러오기 실패", loading: false });
    }
  },

  addRecord: async (record, localOwnerId, shardPrice, isLoggedIn = false) => {
    try {
      const newRecord: Record = {
        id: crypto.randomUUID(),
        ...record,
        local_owner_id: localOwnerId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sync_status: "local",
      };

      if (isLoggedIn) {
        // 서버에 저장
        const res = await fetch('/api/records', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: newRecord.id,
            date: newRecord.date,
            time_minutes: newRecord.time_minutes,
            meso: newRecord.meso,
            shard_count: newRecord.shard_count,
            material_cost: newRecord.material_cost,
            memo: newRecord.memo,
            shard_value: Math.floor(newRecord.shard_count * shardPrice),
            total_revenue: Math.floor(newRecord.meso + newRecord.shard_count * shardPrice),
            net_revenue: Math.floor(newRecord.meso + newRecord.shard_count * shardPrice - newRecord.material_cost),
            meso_per_hour: newRecord.time_minutes > 0 ? Math.floor(newRecord.meso / (newRecord.time_minutes / 60)) : 0,
            net_per_hour: newRecord.time_minutes > 0 ? Math.floor((newRecord.meso + newRecord.shard_count * shardPrice - newRecord.material_cost) / (newRecord.time_minutes / 60)) : 0,
            shard_per_hour: newRecord.time_minutes > 0 ? Math.floor(newRecord.shard_count / (newRecord.time_minutes / 60)) : 0,
            created_at: newRecord.created_at,
            updated_at: newRecord.updated_at,
          }),
        });
        if (!res.ok) throw new Error('서버 저장 실패');
      } else {
        // 로컬에 저장
        await saveRecord(newRecord, localOwnerId);
      }

      const enriched = enrichRecordWithCalculations(newRecord, shardPrice);
      set((state) => ({ records: [enriched, ...state.records] }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "저장 실패" });
    }
  },

  deleteRecord: async (id, isLoggedIn = false) => {
    try {
      if (isLoggedIn) {
        const res = await fetch(`/api/records/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('서버 삭제 실패');
      } else {
        await deleteLocalRecord(id);
      }
      set((state) => ({ records: state.records.filter((r) => r.id !== id) }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "삭제 실패" });
    }
  },

  clearError: () => set({ error: null }),
}));
