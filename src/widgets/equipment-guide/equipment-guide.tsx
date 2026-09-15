'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import type { LocalCharacterProfile } from '@/shared/lib/character-storage';
import { useQuery } from '@tanstack/react-query';
import { useStoredCharacterProfile } from '@/shared/lib/hooks/useStoredCharacterProfile';
import { EQUIPMENT_SLOTS, type EquipmentSlotId, type EquipmentGuideDataset } from './model';
import { ItemIcon, Statistics } from './statistics';
import { Compare } from './compare';
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
  const dialog = useRef<HTMLDialogElement>(null);
  const query = useQuery({
    queryKey: ['equipment-guide', job, power],
    enabled: !!job && typeof power === 'number' && power > 0,
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/equipment-guide?' + new URLSearchParams({ job, power: String(power) }), { signal });
      if (!response.ok) throw new Error('장비 통계를 불러오지 못했어요.');
      return response.json() as Promise<EquipmentGuideDataset & { stale: boolean }>;
    },
    staleTime: 300_000,
  });
  const data = query.data ?? { source: 'api', stats: [] };
  const slot = EQUIPMENT_SLOTS.find(item => item.id === selected)!;
  const stat = data.stats.find(item => item.slot === selected);
  const comparison = query.data?.cohort ? `${formatPower(query.data.cohort.powerMin)} ~ ${formatPower(query.data.cohort.powerMax)}` : '가까운 전투력 표본';
  function selectSlot(id: EquipmentSlotId, open: boolean) {
    setSelected(id);
    if (open && window.matchMedia('(max-width: 767px)').matches) dialog.current?.showModal();
  }
  return <main className={styles.page}>
    <header className={styles.header}><div><p className={styles.eyebrow}>내 캐릭터의 다음 장비</p><h1>장비 가이드</h1><p>내 캐릭터와 같은 직업·비슷한 전투력의 장비를 비교해 보세요.</p></div><span className={styles.demoBadge}>Nexon 실제 장비 표본</span></header>
    <div className={styles.filters}>
      <div><strong>{profile.character_name}</strong><p className={styles.sample}>{job} · 현재 선택한 내 캐릭터</p><Link href="/settings">캐릭터 변경 →</Link></div>
      <div><strong>내 전투력 {typeof power === 'number' ? formatPower(power) : '정보 없음'}</strong><p className={styles.sample}>가까운 표본을 자동으로 찾아요</p></div>
    </div>
    <p className={styles.notice}>종합 랭킹에서 수집한 실제 착용 장비입니다. 아이템 드롭률·메소 획득량 잠재를 장착한 재획 세팅은 제외하며, 표본이 적은 구간은 사용 비율이 크게 달라질 수 있어요.</p>
    {!(typeof power === 'number' && power > 0) && <p className={styles.notice}>내 전투력 정보가 있어야 가까운 표본을 찾을 수 있어요. 설정에서 캐릭터를 다시 불러와 주세요.</p>}
    {query.isPending && query.isFetching && <p role="status">실제 장비 통계를 불러오는 중이에요.</p>}
    {query.isError && <p role="alert">장비 통계를 불러오지 못했어요. <button onClick={() => query.refetch()}>다시 시도</button></p>}
    {query.isFetched && !query.isError && !data.stats.length && !query.data?.stale && <p role="status" className={styles.notice}>{job}의 비교 표본을 아직 확보하지 못했어요. 아래에서 내 장비는 확인할 수 있어요.</p>}
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
              className={styles.slot} aria-label={item.label + (itemStat ? ' 장비 통계 보기' : ' · 데이터 없음')} aria-pressed={selected === item.id}
              onMouseEnter={() => { if (window.matchMedia('(hover: hover) and (min-width: 768px)').matches) selectSlot(item.id, false); }}
              onFocus={() => selectSlot(item.id, false)} onClick={() => selectSlot(item.id, true)}>
              <ItemIcon key={itemStat?.items[0]?.itemIcon ?? item.id} src={itemStat?.items[0]?.itemIcon} /><span>{item.label}</span>
            </button>;
          })}
        </div>
        <p className={styles.hint}>장비 슬롯을 선택해 사용 비율과 강화 분포를 확인하세요.</p>
        <div className={styles.legend}><span>● 선택한 부위</span><span>◇ 데이터 준비 중</span></div>
      </section>
      <aside className={styles.statistics} aria-label="선택한 장비 상세 통계">{!query.isPending && !query.isError && <Statistics stat={stat} label={slot.label} comparison={comparison} />}</aside>
    </div>
    <section className={styles.info}><h2>통계 안내</h2><p>동일 날짜의 Nexon Open API 장비 중 내 캐릭터와 같은 직업이고 전투력이 가까운 캐릭터를 최대 50명까지 묶어 비교합니다. 순위·레벨 기반 표본이므로 전체 유저의 장비 분포와 다를 수 있어요.</p><p>아이템 사용 비율은 해당 부위 착용자 기준이며, 강화·잠재 통계는 가장 많이 사용한 아이템의 착용자 기준입니다.</p><p>Data based on NEXON Open API</p></section>
    <Compare selectedSlot={selected} characterName={profile?.character_name} characterJob={profile?.character_class} stat={stat} />
    <dialog ref={dialog} className={styles.dialog} aria-label={slot.label + ' 장비 통계'} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className={styles.dialogBody}><button autoFocus className={styles.close} aria-label="장비 통계 닫기" onClick={() => dialog.current?.close()}>닫기 ✕</button><Statistics stat={stat} label={slot.label} comparison={comparison} /></div>
    </dialog>
  </main>;
}

function formatPower(value: number) {
  return value >= 100_000_000 ? `${Math.round(value / 10_000_000) / 10}억` : `${Math.round(value / 1_000_000)}백만`;
}
