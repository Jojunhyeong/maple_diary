import { create } from "zustand";
import { Goal } from "@/shared/types";
import { saveGoals as saveLocalGoals, getAllGoalsByOwner } from "@/shared/lib/db/local";

type GoalDraft = Omit<Goal, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

interface GoalStore {
  currentGoals: Goal[];
  currentGoal: Goal | null;
  loading: boolean;
  error: string | null;

  loadGoal: (localOwnerId: string, isLoggedIn?: boolean) => Promise<void>;
  saveGoals: (
    goals: GoalDraft[],
    localOwnerId: string,
    isLoggedIn?: boolean
  ) => Promise<void>;
  clearError: () => void;
}

export const useGoalStore = create<GoalStore>((set) => ({
  currentGoals: [],
  currentGoal: null,
  loading: false,
  error: null,

  loadGoal: async (localOwnerId, isLoggedIn = false) => {
    set({ loading: true });
    try {
      if (isLoggedIn) {
        const res = await fetch('/api/goals');
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.dbError?.message || data.error || '목표 불러오기 실패');
        }
        const goals = await res.json();
        const currentGoals = Array.isArray(goals) ? goals : [];
        set({ currentGoals, currentGoal: currentGoals[0] ?? null, loading: false, error: null });
      } else {
        const goals = await getAllGoalsByOwner(localOwnerId);
        set({ currentGoals: goals, currentGoal: goals[0] ?? null, loading: false, error: null });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "불러오기 실패", loading: false });
    }
  },

  saveGoals: async (goals, localOwnerId, isLoggedIn = false) => {
    try {
      const now = new Date().toISOString();
      const normalizedGoals = goals.map((goal) => ({
        ...goal,
        id: goal.id || crypto.randomUUID(),
        position: goal.position ?? 0,
        created_at: goal.created_at || now,
        updated_at: now,
      }));

      if (isLoggedIn) {
        const res = await fetch('/api/goals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            goals: normalizedGoals,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.dbError?.message || data.error || '목표 저장 실패');
        }
        const saved = await res.json();
        const currentGoals = Array.isArray(saved) ? saved : [];
        set({ currentGoals, currentGoal: currentGoals[0] ?? null, error: null });
      } else {
        await saveLocalGoals(normalizedGoals, localOwnerId);
        set({ currentGoals: normalizedGoals, currentGoal: normalizedGoals[0] ?? null, error: null });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "저장 실패" });
    }
  },

  clearError: () => set({ error: null }),
}));
