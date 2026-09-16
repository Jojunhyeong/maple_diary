'use client';
import { useRef, useState } from 'react';
import { EQUIPMENT_SLOTS, type EquipmentGuideLoadout } from './model';
import { ItemIcon } from './statistics';
import styles from './styles.module.css';

export function LoadoutCarousel({ loadouts }: { loadouts?: EquipmentGuideLoadout[] }) {
  const [active, setActive] = useState(0);
  const touchStart = useRef<number | null>(null);
  if (!loadouts?.length) return null;
  const move = (next: number) => setActive(Math.max(0, Math.min(loadouts.length - 1, next)));
  function finishSwipe(clientX: number) {
    if (touchStart.current === null) return;
    const distance = touchStart.current - clientX;
    if (Math.abs(distance) >= 45) move(active + (distance > 0 ? 1 : -1));
    touchStart.current = null;
  }
  return <section className={styles.loadouts} aria-labelledby="loadout-title">
    <div className={styles.loadoutTitle}>
      <div><p className={styles.eyebrow}>실제 캐릭터 조합</p><h2 id="loadout-title">전체 장비 세팅</h2><p>한 캐릭터가 같은 날 함께 착용한 장비예요. 세트 효과와 부위별 투자 균형을 통째로 비교해 보세요.</p></div>
      <div className={styles.loadoutNav}><span>{active + 1} / {loadouts.length}</span><button type="button" aria-label="이전 전체 세팅" disabled={active === 0} onClick={() => move(active - 1)}>‹</button><button type="button" aria-label="다음 전체 세팅" disabled={active === loadouts.length - 1} onClick={() => move(active + 1)}>›</button></div>
    </div>
    <div className={styles.loadoutViewport} onTouchStart={event => { touchStart.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={event => finishSwipe(event.changedTouches[0]?.clientX ?? 0)}>
      <div className={styles.loadoutTrack} style={{ transform: `translate3d(-${active * 100}%,0,0)` }}>
        {loadouts.map((loadout, index) => <article key={loadout.id} className={styles.loadoutSlide} aria-hidden={index !== active} inert={index !== active}>
          <div className={styles.loadoutMeta}><div><strong>대표 세팅 {index + 1}</strong><span>전투력 {formatPower(loadout.power)} · {loadout.date} 기준</span></div><small>캐릭터명 비공개</small></div>
          <div className={styles.setBadges}>{loadout.setEffects.length ? loadout.setEffects.map(effect => <span key={effect.name}>{effect.name} {effect.count}세트</span>) : <span>주요 세트 효과 없음</span>}</div>
          <div className={styles.loadoutGrid}>{EQUIPMENT_SLOTS.map(slot => {
            const item = loadout.items.find(value => value.slot === slot.id);
            return <div key={slot.id} className={styles.loadoutItem} title={item?.itemName}>
              <ItemIcon src={item?.itemIcon} /><span>{slot.label}</span><strong>{item?.itemName ?? '미착용'}</strong>
              {item && <small>{item.starforce !== undefined ? `${item.starforce}성` : '스타포스 없음'}{item.potentialGrade ? ` · ${item.potentialGrade}` : ''}{item.additionalPotentialGrade ? ` / 에디 ${item.additionalPotentialGrade}` : ''}</small>}
            </div>;
          })}</div>
        </article>)}
      </div>
    </div>
    <div className={styles.detailDots} aria-label="전체 세팅 선택">{loadouts.map((loadout, index) => <button type="button" key={loadout.id} aria-label={`대표 세팅 ${index + 1}`} aria-current={index === active ? 'true' : undefined} onClick={() => move(index)} />)}</div>
    <p className={styles.sample}>서로 다른 세트 구성을 우선해 최대 5개를 선정합니다. 각 카드는 실제 한 캐릭터의 조합이며, 여러 캐릭터의 인기 부위를 합친 가상 세팅이 아닙니다.</p>
  </section>;
}

function formatPower(value: number) {
  return value >= 100_000_000 ? `${Math.round(value / 1_000_000) / 100}억` : `${Math.round(value / 1_000_000)}백만`;
}
