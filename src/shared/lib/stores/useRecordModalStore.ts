import { create } from 'zustand';
import type { RecordWithCalculations } from '@/shared/types';

interface RecordModalStore {
  isOpen: boolean;
  editingRecord: RecordWithCalculations | null;
  open: () => void;
  openForEdit: (record: RecordWithCalculations) => void;
  close: () => void;
}

export const useRecordModalStore = create<RecordModalStore>((set) => ({
  isOpen: false,
  editingRecord: null,
  open: () => set({ isOpen: true, editingRecord: null }),
  openForEdit: (record) => set({ isOpen: true, editingRecord: record }),
  close: () => set({ isOpen: false, editingRecord: null }),
}));
