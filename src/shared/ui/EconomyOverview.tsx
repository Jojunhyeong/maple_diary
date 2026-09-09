'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useGoalsQuery } from '@/shared/lib/queries/useGoalsQuery';
import { useAccountMesoQuery } from '@/shared/lib/queries/useAccountMesoQuery';
import { useEconomy } from '@/shared/lib/hooks/useEconomy';
import { estimateGoalWeeks } from '@/shared/lib/utils/economy';
import { formatMeso } from '@/shared/lib/utils/formatters';
import type { GoalTarget } from '@/shared/types';
import { MapleActivityIcon } from './MapleActivityIcon';

export const SOURCE_META = {
  hunting: { label: '사냥', icon: <MapleActivityIcon kind="hunting" />, href: '/records', color: 'var(--hunting)' },
  boss: { label: '보스', icon: <MapleActivityIcon kind="boss" />, href: '/boss', color: 'var(--boss)' },
  gathering: { label: '채집', icon: <MapleActivityIcon kind="gathering" />, href: '/gathering', color: 'var(--gathering)' },
};
export function SignedMeso({ value }: { value: number }) {
  return <span className={value < 0 ? 'diary-negative' : 'diary-positive'}>{value > 0 ? '+' : value < 0 ? '−' : ''}{formatMeso(Math.abs(value))}</span>;
}
export function IncomeSources({ sources }: { sources: { hunting: number; boss: number; gathering: number } }) {
  const total = sources.hunting + sources.boss + sources.gathering;
  return <div className="diary-sources">{(Object.keys(SOURCE_META) as Array<keyof typeof SOURCE_META>).map(key => {
    const meta = SOURCE_META[key];
    const percent = total > 0 ? sources[key] / total * 100 : 0;
    return <Link href={meta.href} key={key} className="diary-source"><span className="diary-source-icon" style={{ color: meta.color }}>{meta.icon}</span><div><div className="diary-source-label"><span>{meta.label}</span><strong>{formatMeso(sources[key])}</strong></div><div className="diary-source-track"><span style={{ width: `${percent}%`, background: meta.color }} /></div></div><small>{percent.toFixed(0)}%</small></Link>;
  })}</div>;
}

export function NextGoal({ economy }: { economy: ReturnType<typeof useEconomy> }) {
  const goals = useGoalsQuery(economy.options);
  const assets = useAccountMesoQuery(economy.options);
  const ordered = [...(goals.data ?? [])].sort((a,b) => (a.position ?? 0) - (b.position ?? 0) || (b.updated_at || b.created_at).localeCompare(a.updated_at || a.created_at));
  const amounts = ordered.map(goal => goal.targets?.[0]?.target_amount ?? goal.meso_goal ?? 0);
  const targets = ordered.flatMap((goal, index) => {
    const previous = amounts.slice(0, index).reduce((sum, amount) => sum + Math.max(0, amount), 0);
    const target: GoalTarget | null = goal.targets?.[0] ?? (goal.meso_goal ? { id: goal.id, kind: 'meso', title: '메소 목표', target_amount: goal.meso_goal } : null);
    if (!target || target.target_amount <= 0) return [];
    const current = Math.min(Math.max(0, (assets.data?.amount ?? 0) - previous), target.target_amount);
    return [{ ...target, previous, current, remaining: Math.max(0, previous + target.target_amount - (assets.data?.amount ?? 0)) }];
  });
  const target = targets.find(target => target.remaining > 0) ?? targets.at(-1);
  const icon = target?.equipment_icon_url || target?.equipment_shape_icon_url;
  const ready = !!assets.data && (economy.options.isLoggedIn || !!economy.options.localOwnerId);
  const percent = target ? Math.min(100, target.current / target.target_amount * 100) : 0;
  const weeks = target && economy.canEstimate ? estimateGoalWeeks(target.remaining, economy.averageWeeklyNet) : null;
  const hasBalance = !!assets.data?.updatedAt && !assets.error;
  const goalReady = ready && !goals.isLoading && !goals.error && !assets.error && !!target;
  return (
    <section className="diary-goal-journey diary-goal-focused diary-goal-standalone" aria-label="다음 목표">
      <div className="diary-goal-identity">
        <div className="diary-goal-title">
          <span className="diary-goal-symbol">{icon ? <Image src={icon} alt={target?.title || '목표 장비'} width={44} height={44} unoptimized /> : target?.kind === 'meso' ? <MapleActivityIcon kind="meso" /> : <span aria-hidden="true">◎</span>}</span>
          <div><span className="diary-eyebrow">나의 다음 목표</span><h2>{goals.error ? '목표를 불러오지 못했어요' : goals.isLoading || !ready ? '목표를 불러오는 중…' : target?.title || '다음엔 어떤 장비를 맞춰볼까요?'}</h2><p>{goalReady ? `목표 가격 ${formatMeso(target.target_amount)}` : '원하는 장비나 메소 목표를 정해보세요.'}</p></div>
        </div>
        <Link href="/goals">{target ? '목표 관리 ↗' : '＋ 목표 만들기'}</Link>
      </div>
      <div className="diary-goal-progression">
        <div className="diary-goal-value"><span>현재 메소 잔액</span><strong>{hasBalance ? formatMeso(assets.data?.amount ?? 0) : '—'}</strong></div>
        <span className="diary-metric-arrow" aria-hidden="true">→</span>
        <div className="diary-goal-value"><span>목표까지 남은 메소</span><strong>{goalReady && hasBalance ? formatMeso(target.remaining) : '—'}</strong></div>
        <span className="diary-metric-arrow" aria-hidden="true">→</span>
        <div className="diary-goal-value diary-goal-completion"><span>목표 진행률</span><strong>{goalReady && hasBalance ? <>{percent.toFixed(0)}<small>%</small></> : '—'}</strong></div>
      </div>
      {goalReady && hasBalance ? <>
        <progress className="diary-progress" value={percent} max={100} aria-label={`${target.title} 진행률`} />
        <div className="diary-goal-labels"><span>현재 기록 기반 잔액으로 계산</span><span>{target.remaining === 0 ? '목표 달성! 🍁' : `${formatMeso(target.remaining)} 남음`}</span></div>
        {target.previous > 0 && <p className="diary-footnote">앞선 목표에 {formatMeso(target.previous)}를 배분한 뒤 계산한 진행률이에요.</p>}
        <div className="diary-goal-estimate">{weeks !== null ? <><strong>{weeks === 0 ? '목표 달성' : `현재 페이스라면 약 ${weeks}주`}</strong><span>최근 4주 평균 순수익 {formatMeso(economy.averageWeeklyNet)}</span></> : <span>4주간 기록이 쌓이면 순수익을 바탕으로 예상 기간을 알려드려요.</span>}</div>
      </> : <p className="diary-footnote">{assets.error ? '보유 메소를 불러오지 못했어요. 새로고침해 다시 시도해 주세요.' : '보유 메소와 목표를 입력하면 남은 금액과 진행률을 확인할 수 있어요.'}</p>}
    </section>
  );
}
