'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { EQUIPMENT_SLOTS, MIN_SAMPLE_COUNT, type EquipmentGuideStat, type EquipmentGuideItem, type GradeDistribution, type OptionDistribution } from './model';
import styles from './styles.module.css';

export function ItemIcon({ src }: { src?: string }) {
  const [failed, setFailed] = useState(false);
  // Game icons remain readable at their native pixel proportions.
  // eslint-disable-next-line @next/next/no-img-element
  return src && !failed ? <img src={src} alt="" width={40} height={40} onError={() => setFailed(true)} /> : <span aria-hidden="true">◇</span>;
}
export function goalLink(item: EquipmentGuideItem, part: string) {
  const params = new URLSearchParams({ guideItem: item.itemName, guidePart: part });
  if (item.catalogSlug) params.set('guideSlug', item.catalogSlug);
  return '/goals?' + params.toString();
}
const grades = [['legendary', '레전드리'], ['unique', '유니크'], ['epic', '에픽'], ['rare', '레어'], ['other', '기타']] as const;
const emptyGrades: GradeDistribution = { legendary: 0, unique: 0, epic: 0, rare: 0, other: 0 };
function Distribution({ title, values, options }: { title: string; values: GradeDistribution; options?: OptionDistribution }) {
  return <section className={styles.detailSection}><h3>{title}</h3>
    <p className={styles.sample}>실제 옵션 구성 / 해당 아이템 착용자 내 사용 비율</p>
    {options?.slice(0, 5).map(option => <div className={styles.optionRow} key={option.label}><strong>{option.label}</strong><span>{option.ratio}% 사용 · {option.count}명</span></div>)}
    {!!options && options.length > 5 && <details><summary>옵션 구성 더 보기 ({options.length - 5}개)</summary>{options.slice(5).map(option => <div className={styles.optionRow} key={option.label}><strong>{option.label}</strong><span>{option.ratio}% 사용 · {option.count}명</span></div>)}</details>}
    <p className={styles.sample}>등급 분포</p>
    {grades.filter(([key]) => values[key] !== undefined).map(([key, label]) =>
    <div className={styles.barRow} key={key}><span>{label}</span><span className={styles.track}><span style={{ width: (values[key] ?? 0) + '%' }} /></span><strong>{values[key]}%</strong></div>
  )}</section>;
}

export function Statistics({ stat, label, comparison }: { stat?: EquipmentGuideStat; label: string; comparison: string }) {
  if (!stat || !stat.items.length) return <div className={styles.empty}><span aria-hidden="true">◇</span><h2>{label}</h2><p>아직 충분한 장비 데이터가 없어요.</p><small>다른 부위를 확인하거나 잠시 후 다시 검색해 보세요.</small></div>;
  return <RankedStatistics key={`${stat.slot}:${stat.cohortPower}`} stat={stat} label={label} comparison={comparison} />;
}

function RankedStatistics({ stat, label, comparison }: { stat: EquipmentGuideStat; label: string; comparison: string }) {
  const items = stat.items.slice(0, 3);
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStart = useRef<number | null>(null);
  function move(next: number) {
    setActiveIndex(Math.max(0, Math.min(items.length - 1, next)));
  }
  function finishSwipe(clientX: number) {
    if (touchStart.current === null) return;
    const distance = touchStart.current - clientX;
    if (Math.abs(distance) >= 45) move(activeIndex + (distance > 0 ? 1 : -1));
    touchStart.current = null;
  }
  return <div className={styles.detailCarouselShell}>
    <div className={styles.detailCarouselNav}>
      <div><strong>{label} 장비 순위</strong><span>{activeIndex + 1} / {items.length}</span></div>
      {items.length > 1 && <div className={styles.detailCarouselActions}>
        <button type="button" aria-label="이전 순위 장비" disabled={activeIndex === 0} onClick={() => move(activeIndex - 1)}>‹</button>
        <button type="button" aria-label="다음 순위 장비" disabled={activeIndex === items.length - 1} onClick={() => move(activeIndex + 1)}>›</button>
      </div>}
    </div>
    <div className={styles.detailViewport}
      onTouchStart={event => { touchStart.current = event.touches[0]?.clientX ?? null; }}
      onTouchEnd={event => finishSwipe(event.changedTouches[0]?.clientX ?? 0)}>
      <div className={styles.detailTrack} style={{ transform: `translate3d(-${activeIndex * 100}%,0,0)` }}>
        {items.map((item, index) => <article key={item.itemName} className={`${styles.detailSlide} ${index === activeIndex ? styles.detailSlideActive : ''}`} aria-hidden={index !== activeIndex} inert={index !== activeIndex}>
          <ItemStatistics item={item} rank={index + 1} stat={stat} label={label} comparison={comparison} />
        </article>)}
      </div>
    </div>
    {items.length > 1 && <div className={styles.detailDots} aria-label="장비 순위 선택">{items.map((item, index) =>
      <button type="button" key={item.itemName} aria-label={`${index + 1}위 ${item.itemName}`} aria-current={index === activeIndex ? 'true' : undefined} onClick={() => move(index)} />
    )}</div>}
  </div>;
}

function ItemStatistics({ item, rank, stat, label, comparison }: { item: EquipmentGuideItem; rank: number; stat: EquipmentGuideStat; label: string; comparison: string }) {
  const part = EQUIPMENT_SLOTS.find(slot => slot.id === stat.slot)?.part ?? label;
  const starforce = item.starforce ?? (rank === 1 ? stat.starforce : {});
  const potential = item.potential ?? (rank === 1 ? stat.potential : emptyGrades);
  const additionalPotential = item.additionalPotential ?? (rank === 1 ? stat.additionalPotential : emptyGrades);
  const potentialOptions = item.potentialOptions ?? (rank === 1 ? stat.potentialOptions : undefined);
  const additionalPotentialOptions = item.additionalPotentialOptions ?? (rank === 1 ? stat.additionalPotentialOptions : undefined);
  return <div>
    <div className={styles.detailHeading}><ItemIcon key={item.itemIcon} src={item.itemIcon} /><div><span className={styles.rankBadge}>{rank}위</span><h2>{item.itemName}</h2><p>{label} · {stat.job} · {comparison}</p></div></div>
    <p className={styles.sample}>수집 표본 {stat.sampleCount.toLocaleString()}명 · {stat.updatedAt} 기준</p>
    {stat.sampleCount < MIN_SAMPLE_COUNT && <p role="status" className={styles.notice}>표본이 적어 참고용으로만 확인해주세요.</p>}
    <div className={styles.ratio}><span>사용 비율</span><strong>{item.ratio}<small>%</small></strong><p>수집한 부위 착용자 중 이 아이템을 사용하는 비율이에요.</p></div>
    <p className={styles.sample}>아래 강화·옵션은 {item.itemName} 착용자 {item.count}명 기준입니다. 동일한 퍼센트 옵션은 합산하며 방어율 무시는 개별 수치로 표시합니다.</p>
    <section className={styles.detailSection}><h3>스타포스</h3>{item.starforceSupported === false || stat.starforceSupported === false ? <p className={styles.sample}>스타포스 적용 대상이 아닌 장비예요.</p> : <div className={styles.metrics}><span>평균 <strong>{starforce.average ?? '—'}성</strong></span><span>중앙값 <strong>{starforce.median ?? '—'}성</strong></span></div>}</section>
    {item.potentialSupported === false || stat.potentialSupported === false ? <p className={styles.sample}>이 장비에는 잠재능력·에디셔널 잠재능력이 적용되지 않아요.</p> : <>
    <Distribution title="잠재능력" values={potential} options={potentialOptions} />
    <Distribution title="에디셔널 잠재능력" values={additionalPotential} options={additionalPotentialOptions} /></>}
    <Link className={styles.goalAction} href={goalLink(item, part)}>이 장비를 목표로 추가 →</Link><p className={styles.sample}>목표 화면에서 금액을 직접 입력해 주세요.</p>
  </div>;
}
