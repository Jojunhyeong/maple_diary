import { create } from "zustand";
import { Expense } from "@/shared/types";
import {
  saveExpense as saveLocalExpense,
  getExpensesByOwner,
  deleteExpense as deleteLocalExpense,
} from "@/shared/lib/db/local";

interface ExpenseStore {
  expenses: Expense[];
  loading: boolean;
  error: string | null;

  loadExpenses: (localOwnerId: string, isLoggedIn?: boolean) => Promise<void>;
  addExpense: (
    expense: Omit<Expense, "id" | "created_at" | "updated_at" | "sync_status">,
    localOwnerId: string,
    isLoggedIn?: boolean
  ) => Promise<void>;
  updateExpense: (
    expense: Expense,
    localOwnerId: string,
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

export const useExpenseStore = create<ExpenseStore>((set) => ({
  expenses: [],
  loading: false,
  error: null,

  loadExpenses: async (localOwnerId, isLoggedIn = false) => {
    set({ loading: true });
    try {
      if (isLoggedIn) {
        const res = await fetch('/api/expenses');
        if (!res.ok) throw new Error('서버에서 지출을 불러오지 못했습니다');
        const rawExpenses = await res.json();
        const expenses = Array.isArray(rawExpenses) ? rawExpenses : [];
        set({ expenses: sortExpenses(expenses), loading: false, error: null });
      } else {
        const expenses = await getExpensesByOwner(localOwnerId);
        set({ expenses: sortExpenses(expenses), loading: false, error: null });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "불러오기 실패", loading: false });
    }
  },

  addExpense: async (expense, localOwnerId, isLoggedIn = false) => {
    try {
      const now = new Date().toISOString();
      const newExpense: Expense = {
        id: crypto.randomUUID(),
        ...expense,
        local_owner_id: localOwnerId,
        created_at: now,
        updated_at: now,
        sync_status: "local",
      };

      let savedExpense = newExpense;
      if (isLoggedIn) {
        const res = await fetch('/api/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newExpense),
        });
        if (!res.ok) throw new Error('서버 저장 실패');
        savedExpense = await res.json();
      } else {
        await saveLocalExpense(newExpense, localOwnerId);
      }

      set((state) => ({
        expenses: sortExpenses([savedExpense, ...state.expenses.filter((item) => item.id !== savedExpense.id)]),
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "저장 실패" });
    }
  },

  updateExpense: async (expense, localOwnerId, isLoggedIn = false) => {
    try {
      const updatedExpense: Expense = {
        ...expense,
        local_owner_id: expense.local_owner_id ?? localOwnerId,
        updated_at: new Date().toISOString(),
      };

      let savedExpense = updatedExpense;
      if (isLoggedIn) {
        const res = await fetch(`/api/expenses/${updatedExpense.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedExpense),
        });
        if (!res.ok) throw new Error('서버 수정 실패');
        savedExpense = await res.json();
      } else {
        await saveLocalExpense(updatedExpense, localOwnerId);
      }

      set((state) => ({
        expenses: sortExpenses([savedExpense, ...state.expenses.filter((item) => item.id !== savedExpense.id)]),
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "수정 실패" });
    }
  },

  deleteExpense: async (id, isLoggedIn = false) => {
    try {
      if (isLoggedIn) {
        const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('서버 삭제 실패');
      } else {
        await deleteLocalExpense(id);
      }
      set((state) => ({ expenses: state.expenses.filter((item) => item.id !== id) }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "삭제 실패" });
    }
  },

  clearError: () => set({ error: null }),
}));
