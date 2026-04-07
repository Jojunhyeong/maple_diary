import { create } from "zustand";
import { Goal } from "@/shared/types";
import { saveGoal, getGoalByMonth } from "@/shared/lib/db/local";

interface GoalStore {
  // State
  currentGoal: Goal | null;
  loading: boolean;
  error: string | null;

  // Actions
  loadGoal: (localOwnerId: string, month: string) => Promise<void>;
  saveGoal: (
    goal: Omit<Goal, "id" | "created_at" | "updated_at">,
    localOwnerId: string
  ) => Promise<void>;
  updateGoal: (updates: Partial<Goal>) => Promise<void>;
  deleteGoal: () => Promise<void>;
  clearError: () => void;
}

export const useGoalStore = create<GoalStore>((set, get) => ({
  // Initial State
  currentGoal: null,
  loading: false,
  error: null,

  // Actions
  loadGoal: async (localOwnerId: string, month: string) => {
    set({ loading: true });
    try {
      const goal = await getGoalByMonth(localOwnerId, month);
      set({
        currentGoal: goal,
        loading: false,
        error: null,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to load goal",
        loading: false,
      });
    }
  },

  saveGoal: async (goal, localOwnerId) => {
    try {
      const newGoal: Goal = {
        id: crypto.randomUUID(),
        ...goal,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await saveGoal(newGoal, localOwnerId);
      set({
        currentGoal: newGoal,
        error: null,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to save goal",
      });
    }
  },

  updateGoal: async (updates: Partial<Goal>) => {
    try {
      const currentGoal = get().currentGoal;
      if (!currentGoal) throw new Error("No goal loaded");

      const updated: Goal = {
        ...currentGoal,
        ...updates,
        updated_at: new Date().toISOString(),
      };

      await saveGoal(updated, currentGoal.local_owner_id!);
      set({
        currentGoal: updated,
        error: null,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to update goal",
      });
    }
  },

  deleteGoal: async () => {
    try {
      const currentGoal = get().currentGoal;
      if (!currentGoal) throw new Error("No goal loaded");

      // IndexedDB에서 목표 삭제 로직 (IMPLEMENTATION_GUIDE에 없으므로 기본 구현)
      const db = await import("@/shared/lib/db/local").then(m => m.initDB());
      const tx = db.transaction(["goals"], "readwrite");
      const store = tx.objectStore("goals");
      await new Promise<void>((resolve, reject) => {
        const request = store.delete(currentGoal.id);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });

      set({
        currentGoal: null,
        error: null,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to delete goal",
      });
    }
  },

  clearError: () => set({ error: null }),
}));