'use client';

import dynamic from 'next/dynamic';
import { useExpenseModalStore } from '@/shared/lib/stores/useExpenseModalStore';
import { useRecordModalStore } from '@/shared/lib/stores/useRecordModalStore';

const RecordModal = dynamic(
  () => import('@/shared/ui/RecordModal').then((module) => module.RecordModal),
  { ssr: false },
);
const ExpenseModal = dynamic(
  () => import('@/shared/ui/ExpenseModal').then((module) => module.ExpenseModal),
  { ssr: false },
);

export function LazyMainModals() {
  const isRecordModalOpen = useRecordModalStore((state) => state.isOpen);
  const isExpenseModalOpen = useExpenseModalStore((state) => state.isOpen);

  return (
    <>
      {isRecordModalOpen && <RecordModal />}
      {isExpenseModalOpen && <ExpenseModal />}
    </>
  );
}
