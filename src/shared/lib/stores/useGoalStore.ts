import { create } from "zustand";
import { Goal } from "@/shared/types";
import { saveGoal as saveLocalGoal, getGoalByMonth } from "@/shared/lib/db/local";

interface GoalStore {
  currentGoal: Goal | null;
  loading: boolean;
  error: string | null;

  loadGoal: (localOwnerId: string, month: string, isLoggedIn?: boolean) => Promise<void>;
  saveGoal: (
    goal: Omit<Goal, "id" | "created_at" | "updated_at">,
    localOwnerId: string,
    isLoggedIn?: boolean
  ) => Promise<void>;
  clearError: () => void;
}

export const useGoalStore = create<GoalStore>((set, get) => ({
  currentGoal: null,
  loading: false,
  error: null,

  loadGoal: async (localOwnerId, month, isLoggedIn = false) => {
    set({ loading: true });
    try {
      if (isLoggedIn) {
        const res = await fetch(`/api/goals?month=${month}`);
        if (!res.ok) throw new Error('목표 불러오기 실패');
        const goal = await res.json();
        set({ currentGoal: goal, loading: false, error: null });
      } else {
        const goal = await getGoalByMonth(localOwnerId, month);
        set({ currentGoal: goal, loading: false, error: null });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "불러오기 실패", loading: false });
    }
  },

  saveGoal: async (goal, localOwnerId, isLoggedIn = false) => {
    try {
      if (isLoggedIn) {
        const res = await fetch('/api/goals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            month: goal.month,
            meso_goal: goal.meso_goal ?? null,
            shard_goal: goal.shard_goal ?? null,
          }),
        });
        if (!res.ok) throw new Error('목표 저장 실패');
        const saved = await res.json();
        set({ currentGoal: saved, error: null });
      } else {
        const existing = get().currentGoal;
        const now = new Date().toISOString();
        const newGoal: Goal = {
          id: existing?.month === goal.month ? existing.id : crypto.randomUUID(),
          ...goal,
          created_at: existing?.month === goal.month ? existing.created_at : now,
          updated_at: now,
        };
        await saveLocalGoal(newGoal, localOwnerId);
        set({ currentGoal: newGoal, error: null });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "저장 실패" });
    }
  },

  clearError: () => set({ error: null }),
}));
