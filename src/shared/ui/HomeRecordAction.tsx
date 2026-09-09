'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { useRecordModalStore } from '@/shared/lib/stores/useRecordModalStore';
import { useExpenseModalStore } from '@/shared/lib/stores/useExpenseModalStore';
import { MapleActivityIcon } from './MapleActivityIcon';

export function HomeRecordAction() {
  const dialog = useRef<HTMLDialogElement>(null);
  const openHunting = useRecordModalStore(state => state.open);
  const openExpense = useExpenseModalStore(state => state.open);
  const choose = (open: () => void) => {
    dialog.current?.close();
    open();
  };
  return <>
    <button type="button" className="diary-secondary-action" aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>＋ 기록</button>
    <dialog ref={dialog} className="diary-record-picker" aria-labelledby="record-picker-title" onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="diary-section-heading"><h2 id="record-picker-title">무엇을 기록할까요?</h2><button type="button" className="diary-text-button" onClick={() => dialog.current?.close()} aria-label="기록 선택 닫기">닫기 ✕</button></div>
      <div className="diary-record-choices">
        <button type="button" onClick={() => choose(openHunting)}><span className="diary-activity-icon"><MapleActivityIcon kind="hunting" /></span><span><strong>사냥</strong><small>획득 메소와 조각 기록</small></span><span aria-hidden="true">→</span></button>
        <button type="button" onClick={() => choose(openExpense)}><span className="diary-activity-icon expense"><MapleActivityIcon kind="expense" /></span><span><strong>지출</strong><small>사용한 메소 기록</small></span><span aria-hidden="true">→</span></button>
        <Link href="/gathering" onClick={() => dialog.current?.close()}><span className="diary-activity-icon gathering"><MapleActivityIcon kind="gathering" /></span><span><strong>채집</strong><small>아이템과 수량 기록 화면으로</small></span><span aria-hidden="true">→</span></Link>
      </div>
    </dialog>
  </>;
}
