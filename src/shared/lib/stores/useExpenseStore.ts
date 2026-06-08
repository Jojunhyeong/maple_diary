import { create } from "zustand";
import { Expense } from "@/shared/types";

interface ExpenseStore {
  expenses: Expense[];
  loading: boolean;
  error: string | null;

  loadExpenses: (isLoggedIn?: boolean) => Promise<void>;
  addExpense: (
    expense: Omit<Expense, "id" | "created_at" | "updated_at" | "sync_status">,
    isLoggedIn?: boolean
  ) => Promise<void>;
  updateExpense: (
    expense: Expense,
    isLoggedIn?: boolean
  ) => Promise<void>;
  deleteExpense: (id: string, isLoggedIn?: boolean) => Promise<void>;
  clearError: () => void;
}

function sortExpenses(expenses: Expense[]) {
  return [...expenses].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      b.created_at.localeCompare(a.created_at) ||
      b.id.localeCompare(a.id),
  );
}

async function readApiError(res: Response, fallback: string) {
  try {
    const text = await res.text();
    if (!text.trim()) return fallback;

    try {
      const body = JSON.parse(text);
      if (body && typeof body.error === 'string' && body.error.trim()) return body.error;
    } catch {
      // not json, fall through to raw text
    }

    return text;
  } catch {
    // ignore
  }

  return fallback;
}

export const useExpenseStore = create<ExpenseStore>((set) => ({
  expenses: [],
  loading: false,
  error: null,

  loadExpenses: async (isLoggedIn = false) => {
    set({ loading: true });
    try {
      if (!isLoggedIn) {
        set({ expenses: [], loading: false, error: null });
        return;
      }

      const res = await fetch('/api/expenses', { cache: 'no-store' });
      if (!res.ok) throw new Error(await readApiError(res, '서버에서 지출을 불러오지 못했습니다'));
      const rawExpenses = await res.json();
      const expenses = Array.isArray(rawExpenses) ? rawExpenses : [];
      set({ expenses: sortExpenses(expenses), loading: false, error: null });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "불러오기 실패", loading: false });
    }
  },

  addExpense: async (expense, isLoggedIn = false) => {
    try {
      if (!isLoggedIn) {
        set({ error: "로그인이 필요합니다" });
        return;
      }

      const now = new Date().toISOString();
      const payload = {
        ...expense,
        created_at: now,
        updated_at: now,
        sync_status: "synced" as const,
      };

      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await readApiError(res, '서버 저장 실패'));
      const savedExpense = await res.json();

      set((state) => ({
        expenses: sortExpenses([savedExpense, ...state.expenses.filter((item) => item.id !== savedExpense.id)]),
        error: null,
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "저장 실패" });
    }
  },

  updateExpense: async (expense, isLoggedIn = false) => {
    try {
      if (!isLoggedIn) {
        set({ error: "로그인이 필요합니다" });
        return;
      }

      const updatedExpense: Expense = {
        ...expense,
        updated_at: new Date().toISOString(),
        sync_status: "synced",
      };

      const res = await fetch(`/api/expenses/${updatedExpense.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedExpense),
      });
      if (!res.ok) throw new Error(await readApiError(res, '서버 수정 실패'));
      const savedExpense = await res.json();

      set((state) => ({
        expenses: sortExpenses([savedExpense, ...state.expenses.filter((item) => item.id !== savedExpense.id)]),
        error: null,
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "수정 실패" });
    }
  },

  deleteExpense: async (id, isLoggedIn = false) => {
    try {
      if (!isLoggedIn) {
        set({ error: "로그인이 필요합니다" });
        return;
      }

      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await readApiError(res, '서버 삭제 실패'));
      set((state) => ({ expenses: state.expenses.filter((item) => item.id !== id), error: null }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "삭제 실패" });
    }
  },

  clearError: () => set({ error: null }),
}));
