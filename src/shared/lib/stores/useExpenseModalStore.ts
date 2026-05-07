import { create } from 'zustand';
import type { Expense } from '@/shared/types';

interface ExpenseModalStore {
  isOpen: boolean;
  editingExpense: Expense | null;
  open: () => void;
  openForEdit: (expense: Expense) => void;
  close: () => void;
}

export const useExpenseModalStore = create<ExpenseModalStore>((set) => ({
  isOpen: false,
  editingExpense: null,
  open: () => set({ isOpen: true, editingExpense: null }),
  openForEdit: (expense) => set({ isOpen: true, editingExpense: expense }),
  close: () => set({ isOpen: false, editingExpense: null }),
}));
