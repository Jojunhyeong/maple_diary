'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import type { LocalCharacterProfile } from '@/shared/lib/character-storage';
import { useQuery } from '@tanstack/react-query';
import { useStoredCharacterProfile } from '@/shared/lib/hooks/useStoredCharacterProfile';
import type { EquipmentGuideDataset, EquipmentGuideLoadout, EquipmentGuideLoadoutItem } from './model';
import { Compare } from './compare';
import { LoadoutCarousel, LoadoutSkeleton } from './loadout-carousel';
import { equipmentGuideBucket } from './cohort';
import styles from './styles.module.css';

export function EquipmentGuide() {
  const profile = useStoredCharacterProfile();
  if (!profile) return <main className={styles.page}>
    <header className={styles.header}><div><h1>장비 가이드</h1><p>내 캐릭터와 같은 직업의 장비를 비교해 보세요.</p></div></header>
    <section className={styles.compare}><h2>비교할 내 캐릭터를 선택해 주세요</h2><p>등록한 캐릭터의 직업과 전투력을 기준으로 장비 통계를 보여드려요.</p><Link href="/settings">캐릭터 등록·선택 →</Link></section>
  </main>;
  return <CharacterEquipmentGuide key={`${profile.id ?? profile.character_name}:${profile.character_class}:${profile.character_combat_power}`} profile={profile} />;
}

function CharacterEquipmentGuide({ profile }: { profile: LocalCharacterProfile }) {
  const job = profile.character_class;
  const power = profile.character_combat_power;
  const [comparison, setComparison] = useState<{ loadout: EquipmentGuideLoadout; item: EquipmentGuideLoadoutItem } | null>(null);
  const [searchStarted, setSearchStarted] = useState(false);
  const [comparisonPower, setComparisonPower] = useState(typeof power === 'number' ? power : 0);
  const [draftPowerEok, setDraftPowerEok] = useState(typeof power === 'number' ? power / 100_000_000 : 0);
  const [powerMode, setPowerMode] = useState<'nexon' | 'history' | 'manual'>('nexon');
  const [historyStatus, setHistoryStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [historyMessage, setHistoryMessage] = useState('');
  const compareDialog = useRef<HTMLDialogElement>(null);
  const requestPower = equipmentGuideBucket(comparisonPower);
  const query = useQuery({
    queryKey: ['equipment-guide', job, requestPower],
    enabled: searchStarted && !!job && comparisonPower >= 50_000_000 && comparisonPower <= 1_400_000_000,
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/equipment-guide?' + new URLSearchParams({ characterId: profile.id ?? '', power: String(comparisonPower) }), { signal });
      if (!response.ok) throw new Error('장비 통계를 불러오지 못했어요.');
      return response.json() as Promise<EquipmentGuideDataset & { stale: boolean }>;
    },
    staleTime: 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: query => query.state.data?.cacheStatus === 'collecting'
      ? query.state.data.retryAfterMs ?? 2_000
      : false,
  });
  const data: EquipmentGuideDataset = query.data ?? { source: 'api', stats: [] };
  function compareItem(loadout: EquipmentGuideLoadout, item: EquipmentGuideLoadoutItem) {
    setComparison({ loadout, item });
    compareDialog.current?.showModal();
  }
  function search() {
    const next = Math.round(draftPowerEok * 100_000_000);
    if (next < 50_000_000 || next > 1_400_000_000) return;
    if (next !== comparisonPower) setComparisonPower(next);
    else if (query.isError || query.data?.cacheStatus === 'collecting') void query.refetch();
    setSearchStarted(true);
  }
  function resetToNexonPower() {
    const next = typeof power === 'number' ? power : 0;
    setPowerMode('nexon');
    setDraftPowerEok(next / 100_000_000);
    setHistoryMessage('');
  }
  async function findBossPower() {
    if (!profile.id) return;
    setHistoryStatus('loading');
    setHistoryMessage('');
    try {
      const response = await fetch('/api/maple/boss-combat-power?' + new URLSearchParams({ characterId: profile.id }));
      const result = await response.json() as { combatPower?: number; date?: string; presetNo?: number | null; error?: string };
      if (!response.ok || !result.combatPower) throw new Error(result.error || '최근 보스 세팅을 찾지 못했어요.');
      setPowerMode('history');
      setDraftPowerEok(result.combatPower / 100_000_000);
      setHistoryMessage(`${result.date} · 프리셋 ${result.presetNo ?? '확인 불가'}번 · ${formatPower(result.combatPower)}`);
      setHistoryStatus('idle');
    } catch (error) {
      setHistoryStatus('error');
      setHistoryMessage(error instanceof Error ? error.message : '최근 보스 세팅을 찾지 못했어요.');
    }
  }
  return <main className={styles.page}>
    <header className={styles.header}><div><p className={styles.eyebrow}>내 캐릭터의 다음 장비</p><h1>장비 가이드</h1><p>내 캐릭터와 같은 직업·비슷한 전투력의 실제 장비 세팅을 비교해 보세요.</p></div><div className={styles.headerControls}><span className={styles.demoBadge}>Nexon 실제 장비 세팅</span></div></header>
    <div className={styles.filters}>
      <div><strong>{profile.character_name}</strong><p className={styles.sample}>{job} · 현재 설정된 내 캐릭터</p></div>
      <div><strong>넥슨 조회 전투력 {typeof power === 'number' ? formatPower(power) : '정보 없음'}</strong><p className={styles.sample}>현재 장착 중인 세팅 기준</p></div>
      <div className={styles.powerEditor}>
        <label>비교 전투력
          <span className={styles.powerInput}><input aria-label="비교 전투력" type="number" min="0.5" max="14" step="0.1" value={draftPowerEok || ''} disabled={powerMode !== 'manual'} onChange={event => setDraftPowerEok(Number(event.target.value))} /><b>억</b></span>
          <small>{powerMode === 'manual' ? '직접 입력한 값' : powerMode === 'history' ? '최근 보스 세팅 기록' : '넥슨 조회값'}</small>
        </label>
        <button type="button" onClick={() => powerMode === 'manual' ? resetToNexonPower() : setPowerMode('manual')}>{powerMode === 'manual' ? '넥슨 값 사용' : '직접 입력'}</button>
      </div>
      <div className={styles.filterActions}>
        <button type="button" disabled={historyStatus === 'loading' || !profile.id} onClick={() => void findBossPower()}>{historyStatus === 'loading' ? '기록 확인 중…' : '최근 보스 세팅 찾기'}</button>
        <button type="button" className={styles.searchButton} disabled={query.isFetching || draftPowerEok < 0.5 || draftPowerEok > 14} onClick={search}>
          <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>{query.data?.cacheStatus === 'collecting' ? '장비 수집 중…' : query.data?.loadouts?.length ? '다시 검색' : '비슷한 장비 검색'}
        </button>
      </div>
    </div>
    {historyMessage && <p role={historyStatus === 'error' ? 'alert' : 'status'} className={styles.notice}>{historyMessage}</p>}
    {query.isPending && query.isFetching && <p role="status">캐시를 확인하는 중이에요.</p>}
    {query.data?.cacheStatus === 'collecting' && <p role="status" className={styles.notice}>같은 직업·비슷한 전투력 캐릭터의 장비를 처음 수집하고 있어요. 완료되면 자동으로 표시됩니다.</p>}
    {query.isError && <p role="alert">장비 통계를 불러오지 못했어요. <button onClick={() => query.refetch()}>다시 시도</button></p>}
    {query.isFetched && !query.isError && !data.loadouts?.length && query.data?.cacheStatus !== 'collecting' && !query.data?.stale && <p role="status" className={styles.notice}>{job}의 유효한 보스 세팅을 불러오지 못했어요. 잠시 후 다시 검색해 주세요.</p>}
    {query.data?.stale && <p role="status">통계 갱신이 필요합니다. 오래된 데이터는 표시하지 않아요.</p>}
    {!!data.loadouts?.length && <LoadoutCarousel loadouts={data.loadouts} characterImage={profile.image_url ?? undefined} characterName={profile.character_name} onSelectItem={compareItem} />}
    {!data.loadouts?.length && !query.isError && <LoadoutSkeleton loading={searchStarted && (query.isFetching || query.data?.cacheStatus === 'collecting')} />}
    <section className={styles.info}><h2>추천 안내</h2><p>추천 세팅은 실제 한 캐릭터가 함께 착용한 전체 장비 조합입니다. 서로 다른 주요 세트 구성을 우선해 최대 3개를 보여주며, 여러 캐릭터의 인기 부위를 섞지 않습니다.</p><p>같은 직업에서 입력한 전투력의 ±2,000만 안에 있는 캐릭터만 사용하며 범위를 임의로 넓히지 않습니다. 드메 잠재 캐릭터는 제외하며 결과는 7일 동안 공유합니다.</p><p>Data based on NEXON Open API</p></section>
    <dialog ref={compareDialog} className={styles.compareDialog} aria-label="내 장비와 비교" onClick={event => { if (event.target === event.currentTarget) compareDialog.current?.close(); }}>
      <div className={styles.modalBody}><button autoFocus className={styles.close} aria-label="내 장비 비교 닫기" onClick={() => compareDialog.current?.close()}>닫기 ✕</button>{comparison && <Compare selectedSlot={comparison.item.slot} characterName={profile?.character_name} recommended={comparison} />}</div>
    </dialog>
  </main>;
}

function formatPower(value: number) {
  return value >= 100_000_000 ? `${Math.round(value / 10_000_000) / 10}억` : `${Math.round(value / 1_000_000)}백만`;
}
