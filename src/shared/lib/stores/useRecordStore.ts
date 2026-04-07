import { create } from "zustand";
import { Record, RecordWithCalculations } from "@/shared/types";
import { saveRecord, getRecordsByOwner, deleteRecord } from "@/shared/lib/db/local";
import { enrichRecordWithCalculations } from "@/shared/lib/utils/calculations";

interface RecordStore {
  // State
  records: RecordWithCalculations[];
  loading: boolean;
  error: string | null;
  lastSyncTime: Date | null;

  // Actions
  loadRecords: (
    localOwnerId: string,
    options?: { startDate?: string; endDate?: string }
  ) => Promise<void>;
  addRecord: (
    record: Omit<Record, "id" | "created_at" | "updated_at">,
    localOwnerId: string,
    shardPrice: number
  ) => Promise<void>;
  updateRecord: (
    id: string,
    updates: Partial<Record>,
    shardPrice: number
  ) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
  syncLocalToServer: (localOwnerId: string) => Promise<void>;
  clearError: () => void;
}

export const useRecordStore = create<RecordStore>((set, get) => ({
  // Initial State
  records: [],
  loading: false,
  error: null,
  lastSyncTime: null,

  // Actions
  loadRecords: async (localOwnerId, options) => {
    set({ loading: true });
    try {
      const rawRecords = await getRecordsByOwner(localOwnerId, options);
      const shardPrice =
        JSON.parse(localStorage.getItem("maple_diary:settings") || "{}").shard_price || 107653;

      const enrichedRecords = rawRecords.map((r) =>
        enrichRecordWithCalculations(r, shardPrice)
      );

      set({
        records: enrichedRecords,
        loading: false,
        error: null,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to load records",
        loading: false,
      });
    }
  },

  addRecord: async (record, localOwnerId, shardPrice) => {
    try {
      const newRecord: Record = {
        id: crypto.randomUUID(),
        ...record,
        local_owner_id: localOwnerId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sync_status: "local",
      };

      await saveRecord(newRecord, localOwnerId);

      const enriched = enrichRecordWithCalculations(newRecord, shardPrice);
      set((state) => ({
        records: [enriched, ...state.records],
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to save record",
      });
    }
  },

  updateRecord: async (id, updates, shardPrice) => {
    try {
      const record = get().records.find((r) => r.id === id);
      if (!record) throw new Error("Record not found");

      const updated: Record = {
        ...record,
        ...updates,
        updated_at: new Date().toISOString(),
        sync_status: "pending",
      };

      await saveRecord(updated, record.local_owner_id!);

      const enriched = enrichRecordWithCalculations(updated, shardPrice);
      set((state) => ({
        records: state.records.map((r) => (r.id === id ? enriched : r)),
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to update record",
      });
    }
  },

  deleteRecord: async (id: string) => {
    try {
      await deleteRecord(id);
      set((state) => ({
        records: state.records.filter((r) => r.id !== id),
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to delete record",
      });
    }
  },

  syncLocalToServer: async (localOwnerId: string) => {
    try {
      const pendingRecords = get().records.filter(
        (r) => r.sync_status === "pending" || r.sync_status === "local"
      );

      for (const record of pendingRecords) {
        await fetch("/api/records", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(record),
        });
      }

      set({ lastSyncTime: new Date() });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Sync failed",
      });
    }
  },

  clearError: () => set({ error: null }),
}));