'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import type { LocalCharacterProfile } from '@/shared/lib/character-storage';
import { useQuery } from '@tanstack/react-query';
import { useStoredCharacterProfile } from '@/shared/lib/hooks/useStoredCharacterProfile';
import { EQUIPMENT_SLOTS, type EquipmentSlotId, type EquipmentGuideDataset } from './model';
import { ItemIcon, Statistics } from './statistics';
import { Compare } from './compare';
import { LoadoutCarousel } from './loadout-carousel';
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
  const [selected, setSelected] = useState<EquipmentSlotId>('hat');
  const [searchStarted, setSearchStarted] = useState(false);
  const [comparisonPower, setComparisonPower] = useState(typeof power === 'number' ? power : 0);
  const [draftPowerEok, setDraftPowerEok] = useState(typeof power === 'number' ? power / 100_000_000 : 0);
  const [powerMode, setPowerMode] = useState<'nexon' | 'history' | 'manual'>('nexon');
  const [historyStatus, setHistoryStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [historyMessage, setHistoryMessage] = useState('');
  const loadoutDialog = useRef<HTMLDialogElement>(null);
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
  const slot = EQUIPMENT_SLOTS.find(item => item.id === selected)!;
  const stat = data.stats.find(item => item.slot === selected);
  const comparison = query.data?.cohort ? `${formatPower(query.data.cohort.powerMin)} ~ ${formatPower(query.data.cohort.powerMax)}` : '가까운 전투력 표본';
  function selectSlot(id: EquipmentSlotId) {
    setSelected(id);
  }
  function compareSlot(id: EquipmentSlotId) {
    setSelected(id);
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
    <header className={styles.header}><div><p className={styles.eyebrow}>내 캐릭터의 다음 장비</p><h1>장비 가이드</h1><p>내 캐릭터와 같은 직업·비슷한 전투력의 장비를 비교해 보세요.</p></div><div className={styles.headerControls}><span className={styles.demoBadge}>Nexon 실제 장비 표본</span><div className={styles.quickActions}><button type="button" disabled={!data.loadouts?.length} onClick={() => loadoutDialog.current?.showModal()}>전체 세팅 보기{data.loadouts?.length ? ` ${data.loadouts.length}` : ''}</button></div></div></header>
    <div className={styles.filters}>
      <div><strong>{profile.character_name}</strong><p className={styles.sample}>{job} · 현재 설정된 내 캐릭터</p></div>
      <div><strong>넥슨 조회 전투력 {typeof power === 'number' ? formatPower(power) : '정보 없음'}</strong><p className={styles.sample}>현재 장착 중인 세팅 기준</p></div>
      <label>비교 전투력
        <span className={styles.powerInput}><input aria-label="비교 전투력" type="number" min="0.5" max="14" step="0.1" value={draftPowerEok || ''} disabled={powerMode !== 'manual'} onChange={event => setDraftPowerEok(Number(event.target.value))} /><b>억</b></span>
        <small>{powerMode === 'manual' ? '직접 입력한 값' : powerMode === 'history' ? '최근 보스 세팅 기록' : '넥슨 조회값'}</small>
      </label>
      <button type="button" onClick={() => powerMode === 'manual' ? resetToNexonPower() : setPowerMode('manual')}>{powerMode === 'manual' ? '넥슨 값 사용' : '직접 입력'}</button>
      <button type="button" disabled={historyStatus === 'loading' || !profile.id} onClick={() => void findBossPower()}>{historyStatus === 'loading' ? '기록 확인 중…' : '최근 보스 세팅 찾기'}</button>
      <button type="button" disabled={query.isFetching || draftPowerEok < 0.5 || draftPowerEok > 14} onClick={search}>
        {query.data?.cacheStatus === 'collecting' ? '장비 수집 중…' : query.data?.stats.length ? '다시 검색' : '비슷한 장비 검색'}
      </button>
    </div>
    <p className={styles.notice}>종합 랭킹에서 수집한 실제 장비입니다. 전투력과 같은 날짜에 적용 중이던 장비만 사용하고, 아이템 드롭률·메소 획득량 잠재가 있으면 표본에서 제외합니다.</p>
    <p className={styles.notice}>새로고침하면 넥슨 조회 전투력으로 돌아갑니다. 직접 입력은 현재 화면에서만 유지되며, 최근 14일 중 드메 잠재가 없는 적용 세팅의 가장 높은 전투력도 찾을 수 있어요.</p>
    {historyMessage && <p role={historyStatus === 'error' ? 'alert' : 'status'} className={styles.notice}>{historyMessage}</p>}
    {query.isPending && query.isFetching && <p role="status">캐시를 확인하는 중이에요.</p>}
    {query.data?.cacheStatus === 'collecting' && <p role="status" className={styles.notice}>같은 직업·비슷한 전투력 캐릭터의 장비를 처음 수집하고 있어요. 완료되면 자동으로 표시됩니다.</p>}
    {query.isError && <p role="alert">장비 통계를 불러오지 못했어요. <button onClick={() => query.refetch()}>다시 시도</button></p>}
    {query.isFetched && !query.isError && !data.stats.length && query.data?.cacheStatus !== 'collecting' && !query.data?.stale && <p role="status" className={styles.notice}>{job}의 가까운 보스 세팅 표본을 30명 이상 확보하지 못했어요. 아래에서 내 장비는 확인할 수 있어요.</p>}
    {query.data?.stale && <p role="status">통계 갱신이 필요합니다. 오래된 데이터는 표시하지 않아요.</p>}
    <div className={styles.workspace}>
      <section className={styles.inventory} aria-label="부위별 장비 통계">
        <div className={styles.panelTitle}><div><h2>많이 사용하는 장비</h2><p>{job} · {comparison}</p></div><span>수집 표본 {stat?.sampleCount ?? 0}명<small>선택 부위 착용자 기준</small></span></div>
        <div className={styles.grid}>
          <div className={styles.portrait}>
            {profile?.image_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={profile.image_url} alt={profile.character_name + ' 캐릭터'} />
              : <svg viewBox="0 0 120 160" aria-hidden="true"><circle cx="60" cy="48" r="25" /><path d="M24 136v-32a36 36 0 0172 0v32Z" /></svg>}
            <strong>{profile?.character_name || '나의 캐릭터'}</strong><small>{profile ? '내 캐릭터 미리보기' : '캐릭터를 연결해 보세요'}</small>
          </div>
          {EQUIPMENT_SLOTS.map(item => {
            const itemStat = data.stats.find(value => value.slot === item.id);
            return <button key={item.id} style={{ gridColumn: item.col, gridRow: item.row }}
              className={styles.slot} aria-label={item.label + (itemStat ? ' 내 장비와 비교' : ' · 데이터 없음')} aria-pressed={selected === item.id}
              onMouseEnter={() => { if (window.matchMedia('(hover: hover) and (min-width: 768px)').matches) selectSlot(item.id); }}
              onFocus={() => selectSlot(item.id)} onClick={() => compareSlot(item.id)}>
              <ItemIcon key={itemStat?.items[0]?.itemIcon ?? item.id} src={itemStat?.items[0]?.itemIcon} /><span>{item.label}</span>
            </button>;
          })}
        </div>
        <p className={styles.hint}>마우스를 올리면 통계가 바뀌고, 클릭하면 내 장비와 바로 비교할 수 있어요.</p>
        <div className={styles.legend}><span>● 선택한 부위</span><span>◇ 데이터 준비 중</span></div>
      </section>
      <aside className={styles.statistics} aria-label="선택한 장비 상세 통계">{!query.isPending && !query.isError && <Statistics stat={stat} label={slot.label} comparison={comparison} />}</aside>
    </div>
    <section className={styles.info}><h2>통계 안내</h2><p>같은 직업에서 검색 전투력과 가장 가까운 유효 캐릭터 30명을 사용합니다. 부위별 착용자도 30명 이상일 때만 통계를 표시합니다.</p><p>프리셋 1~3 중 아이템 드롭률·메소 획득량 잠재가 없는 가장 강한 장비 세팅을 사용합니다. 같은 직업·전투력 구간의 결과는 7일 동안 공유합니다.</p><p>Data based on NEXON Open API</p></section>
    <dialog ref={loadoutDialog} className={styles.modalDialog} aria-label="전체 장비 세팅" onClick={event => { if (event.target === event.currentTarget) loadoutDialog.current?.close(); }}>
      <div className={styles.modalBody}><button autoFocus className={styles.close} aria-label="전체 장비 세팅 닫기" onClick={() => loadoutDialog.current?.close()}>닫기 ✕</button><LoadoutCarousel loadouts={data.loadouts} /></div>
    </dialog>
    <dialog ref={compareDialog} className={styles.compareDialog} aria-label="내 장비와 비교" onClick={event => { if (event.target === event.currentTarget) compareDialog.current?.close(); }}>
      <div className={styles.modalBody}><button autoFocus className={styles.close} aria-label="내 장비 비교 닫기" onClick={() => compareDialog.current?.close()}>닫기 ✕</button><Compare selectedSlot={selected} characterName={profile?.character_name} characterJob={profile?.character_class} stat={stat} /></div>
    </dialog>
  </main>;
}

function formatPower(value: number) {
  return value >= 100_000_000 ? `${Math.round(value / 10_000_000) / 10}억` : `${Math.round(value / 1_000_000)}백만`;
}
