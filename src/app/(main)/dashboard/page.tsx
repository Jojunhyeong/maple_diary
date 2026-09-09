'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { HomeRecordAction } from '@/shared/ui/HomeRecordAction';
import { HomeAssetFlow } from '@/shared/ui/HomeAssetFlow';
import { AccountMesoCard } from '@/shared/ui/AccountMesoCard';
import { useAccountMesoQuery } from '@/shared/lib/queries/useAccountMesoQuery';
import { MapleActivityIcon } from '@/shared/ui/MapleActivityIcon';
import { useStoredCharacterProfile } from '@/shared/lib/hooks/useStoredCharacterProfile';
import { useRouter } from 'next/navigation';
import { useMigrateOnLogin } from '@/shared/lib/hooks/useMigrateOnLogin';
import { useEconomy } from '@/shared/lib/hooks/useEconomy';
import { useRecordModalStore } from '@/shared/lib/stores/useRecordModalStore';
import { NextGoal, SignedMeso, SOURCE_META } from '@/shared/ui/EconomyOverview';
import { formatDate, formatMeso } from '@/shared/lib/utils/formatters';

export default function DashboardPage() {
  const economy = useEconomy();
  const profile = useStoredCharacterProfile();
  const router = useRouter();
  useMigrateOnLogin();
  const openRecord = useRecordModalStore(state => state.open);
  useEffect(() => { if (!localStorage.getItem('maple_diary:onboarding_done')) router.replace('/onboarding'); }, [router]);
  const { weekly } = economy;
  const balance = useAccountMesoQuery(economy.options);
  const balanceAdjustments = (balance.data?.history ?? []).filter(entry => entry.entryType === 'initial_balance' || entry.entryType === 'manual_adjustment').map(entry => ({
    id: `balance-${entry.id}`,
    date: entry.createdAt.slice(0, 10),
    createdAt: entry.createdAt,
    title: entry.entryType === 'initial_balance' ? '초기 잔액 설정' : '잔액 조정',
    kind: 'balance' as const,
    income: entry.delta > 0 ? entry.delta : 0,
    expense: entry.delta < 0 ? Math.abs(entry.delta) : 0,
  }));
  const recent = [...economy.entries.filter(entry => entry.date <= formatDate(economy.today)).map(entry => ({ ...entry, createdAt: `${entry.date}T00:00:00` })), ...balanceAdjustments]
    .sort((a,b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)).slice(0,5);
  return <main className="diary-home maple-fade-up">
    <div className="diary-page-heading"><div><div className="diary-eyebrow">나의 메이플 기록</div><h1>쌓이는 기록만큼, 가까워지는 목표</h1></div><HomeRecordAction /></div>
    <section className="diary-weekly-primary" aria-labelledby="weekly-profit-title">
      <div className="diary-section-heading"><div><h2 id="weekly-profit-title">이번 주 순수익</h2><p>{formatDate(economy.weekStart).slice(5).replace('-', '. ')} — {formatDate(economy.weekEnd).slice(5).replace('-', '. ')} · 계정 전체</p></div><Link href="/analysis">수익 분석 ↗</Link></div>
      {economy.loading ? <p className="diary-empty" role="status">이번 주 기록을 불러오는 중…</p> : economy.error ? <p className="diary-error" role="alert">{economy.error.message} 페이지를 새로고침해 다시 시도해 주세요.</p> : <>
        <div className="diary-profit-headline"><div className="diary-net"><strong><SignedMeso value={weekly.net} /></strong><span>메소</span></div><div className="diary-profit-formula" aria-label="총 수익 빼기 총 지출은 순수익"><span>총 수익 <strong>{formatMeso(weekly.income)}</strong></span><b aria-hidden="true">−</b><span>총 지출 <strong>{formatMeso(weekly.expense)}</strong></span><b aria-hidden="true">=</b><span className="diary-formula-result">순수익 <strong><SignedMeso value={weekly.net} /></strong></span></div></div>
        <div className="diary-contributions" aria-label="주간 순수익 구성">
          {(Object.keys(SOURCE_META) as Array<keyof typeof SOURCE_META>).map(key => <Link href={SOURCE_META[key].href} key={key} className={`diary-contribution ${key}`}><span className="diary-contribution-label"><span className="diary-activity-icon">{SOURCE_META[key].icon}</span>{SOURCE_META[key].label}<span aria-hidden="true">↗</span></span><strong><SignedMeso value={weekly.sources[key]} /></strong><small>{key === 'hunting' ? '메소 · 조각 평가액' : key === 'boss' ? '저장된 보스 정산액' : '아이템 평가액'}</small></Link>)}
          <Link href="/expenses" className="diary-contribution expense"><span className="diary-contribution-label"><span className="diary-activity-icon"><MapleActivityIcon kind="expense" /></span>지출<span aria-hidden="true">↗</span></span><strong><SignedMeso value={-weekly.expense} /></strong><small>사냥 재료비 포함</small></Link>
        </div>
        <details className="diary-calculation-note"><summary>집계 기준</summary><p>조각·채집은 기록된 단가 기준 평가액을 포함합니다. 보스는 저장된 주·월 정산액 기준이며 실제 처치일과 다를 수 있어요. 메이플포인트는 별도로 집계합니다.</p></details>
        {!economy.isLoggedIn && <Link className="diary-login-note" href="/login">로그인하면 보스·채집·지출 기록도 함께 볼 수 있어요 ↗</Link>}
      </>}
    </section>
    <section className="diary-current-balance" aria-label="현재 메소 잔액">
      <AccountMesoCard showHistory weekStart={economy.weekStart} />
    </section>
    <HomeAssetFlow economy={economy} />
    <NextGoal economy={economy} />
    <section className="diary-activity"><div className="diary-section-heading"><div><h2>최근 활동</h2><p>차곡차곡 쌓인 나의 메이플 기록</p></div><Link href="/records">기록 보기 ↗</Link></div>
      <div className="diary-activity-table"><div className="diary-activity-head"><span>활동</span><span>기록일</span><span>수익 / 지출</span></div>
        {economy.loading ? <p className="diary-empty">기록을 불러오는 중…</p> : economy.error ? <p className="diary-empty">기록을 불러오지 못했어요.</p> : recent.length === 0 ? <div className="diary-empty"><p>아직 기록이 없어요. 오늘의 첫 수익을 남겨보세요.</p><button onClick={openRecord} className="diary-text-button">＋ 첫 사냥 기록하기</button></div> : recent.map(entry => {
          const href = entry.kind === 'balance' ? '/dashboard' : entry.kind === 'expense' ? '/expenses' : SOURCE_META[entry.kind].href;
          const characterId = 'characterId' in entry ? entry.characterId : undefined;
          return <Link href={href} className="diary-activity-row" key={entry.id}><span><i className={`diary-activity-icon ${entry.kind}`}>{characterId === profile?.id && profile?.image_url ? <Image src={profile.image_url} alt={`${profile.character_name} 캐릭터`} width={36} height={36} unoptimized /> : entry.kind === 'balance' ? <MapleActivityIcon kind="meso" /> : entry.kind === 'expense' ? <MapleActivityIcon kind="expense" /> : SOURCE_META[entry.kind].icon}</i><span><strong>{entry.title}</strong><small>{entry.kind === 'balance' ? '기록 기준 잔액' : entry.kind === 'expense' ? entry.category || '지출' : SOURCE_META[entry.kind].label}</small></span></span><time dateTime={entry.date}>{entry.date.slice(5).replace('-', '. ')}</time><strong><SignedMeso value={entry.income - entry.expense} /></strong></Link>;
        })}
      </div>
    </section>
    <footer className="diary-footer"><span>🍁 메이플 다이어리</span><span>나만의 메이플 경제 다이어리</span></footer>
  </main>;
}
