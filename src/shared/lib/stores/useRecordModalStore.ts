import { create } from 'zustand';

interface RecordModalStore {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useRecordModalStore = create<RecordModalStore>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
