'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useAccountMesoQuery } from '@/shared/lib/queries/useAccountMesoQuery';
import { MESO_HISTORY_EVENT, readMesoHistory } from '@/shared/lib/account-meso-history-storage';
import { mergeMesoSnapshots, sevenDayMesoBalances, type MesoSnapshot } from '@/shared/lib/utils/account-meso-history';
import type { useEconomy } from '@/shared/lib/hooks/useEconomy';
import { formatMeso } from '@/shared/lib/utils/formatters';
import { SignedMeso } from './EconomyOverview';

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(MESO_HISTORY_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(MESO_HISTORY_EVENT, onChange);
  };
}
const serverSnapshot = () => '[]';

export function HomeAssetFlow({ economy }: { economy: ReturnType<typeof useEconomy> }) {
  const balance = useAccountMesoQuery(economy.options);
  const { isLoggedIn, userId, localOwnerId } = economy.options;
  const ownerKey = isLoggedIn ? `server:${userId ?? 'pending-session'}` : `local:${localOwnerId ?? 'pending-local'}`;
  const getSnapshot = useCallback(() => JSON.stringify(readMesoHistory(ownerKey)), [ownerKey]);
  const serialized = useSyncExternalStore(subscribe, getSnapshot, serverSnapshot);
  const days = useMemo(() => {
    const saved = JSON.parse(serialized) as MesoSnapshot[];
    const ledger = (balance.data?.history ?? []).map((entry) => ({
      amount: entry.amountAfter,
      updatedAt: entry.createdAt,
    }));
    return sevenDayMesoBalances(
      mergeMesoSnapshots([...saved, ...ledger], balance.data ?? { amount: 0, updatedAt: null }),
      economy.today,
    );
  }, [serialized, balance.data, economy.today]);
  const known = days.filter((day): day is typeof day & { amount: number } => day.amount !== null);
  const min = Math.min(...known.map(day => day.amount));
  const max = Math.max(...known.map(day => day.amount));
  const x = (index: number) => (index + 0.5) * 600 / 7;
  const y = (amount: number) => max === min ? 30 : 50 - (amount - min) / (max - min) * 40;
  const delta = known.length > 1 ? known[known.length - 1].amount - known[0].amount : null;
  const loading = balance.isLoading || (!isLoggedIn && !localOwnerId);
  return <section className="diary-asset-flow" aria-labelledby="asset-flow-title">
    <div className="diary-section-heading"><div><h2 id="asset-flow-title">최근 7일 자산 흐름</h2><p>수입·지출 기록과 잔액 조정으로 계산한 기록 기반 잔액</p></div>{!balance.error && delta !== null && <span className="diary-flow-change">기록일 간 <SignedMeso value={delta} /></span>}</div>
    {loading ? <p className="diary-flow-empty" role="status">잔액 이력을 불러오는 중…</p> : balance.error ? <p className="diary-flow-empty" role="alert">잔액을 불러오지 못했어요. 새로고침해 다시 확인해 주세요.</p> : known.length < 2 ? <div className="diary-flow-empty"><span aria-hidden="true">↗</span><div><strong>아직 비교할 자산 변화가 부족해요</strong><p>두 날짜 이상의 잔액 변경 기록이 쌓이면 흐름을 보여드려요.</p><small>변경 기록이 없는 날짜의 잔액은 추정하지 않아요.</small></div></div> : <>
      <svg className="diary-flow-chart" viewBox="0 0 600 60" preserveAspectRatio="none" role="img" aria-label={`최근 7일 중 ${known.length}일의 입력 잔액. 기록이 없는 날은 비워 표시합니다.`}>
        <path d="M43 54H557" stroke="var(--border)" strokeDasharray="3 5" />
        {days.map((day, index) => {
          if (day.amount === null) return null;
          const previous = days[index - 1];
          return <g key={day.date}>
            {previous?.amount !== null && previous?.amount !== undefined && <line x1={x(index - 1)} y1={y(previous.amount)} x2={x(index)} y2={y(day.amount)} stroke="var(--brand-primary)" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
            <circle cx={x(index)} cy={y(day.amount)} r="3" fill="var(--brand-primary)"><title>{day.date}: {formatMeso(day.amount)}</title></circle>
          </g>;
        })}
      </svg>
      <div className="diary-flow-dates">{days.map(day => <span key={day.date}><time dateTime={day.date}>{day.date.slice(5).replace('-', '/')}</time><strong>{day.amount === null ? '기록 없음' : formatMeso(day.amount)}</strong></span>)}</div>
      <p className="diary-footnote">변경 기록이 없는 날은 잔액을 추정하지 않고 비워 두어요.</p>
    </>}
  </section>;
}
