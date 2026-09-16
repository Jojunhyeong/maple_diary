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

export function ItemRankingCarousel({ stat, label, compact = false }: { stat: EquipmentGuideStat; label: string; compact?: boolean }) {
  const scroller = useRef<HTMLDivElement>(null);
  const items = stat.items.slice(0, 3);
  function move(direction: -1 | 1) {
    scroller.current?.scrollBy({ left: direction * (compact ? 180 : 240), behavior: 'smooth' });
  }
  return <section className={`${styles.itemCarousel} ${compact ? styles.itemCarouselCompact : ''}`} aria-label={`${label} 인기 장비 1위부터 ${items.length}위`}>
    <div className={styles.carouselHeading}><div><strong>{label} 인기 장비</strong><span>좌우로 넘겨 1~3순위를 확인하세요</span></div>
      {items.length > 1 && <div className={styles.carouselControls}><button type="button" aria-label="이전 장비" onClick={() => move(-1)}>‹</button><button type="button" aria-label="다음 장비" onClick={() => move(1)}>›</button></div>}
    </div>
    <div className={styles.carouselTrack} ref={scroller} tabIndex={items.length > 1 ? 0 : undefined}>
      {items.map((item, index) => <article className={styles.itemCard} key={item.itemName}>
        <span className={styles.itemRank}>{index + 1}위</span>
        <ItemIcon src={item.itemIcon} />
        <strong>{item.itemName}</strong>
        <p><b>{item.ratio}%</b><span>{item.count}명 사용</span></p>
      </article>)}
    </div>
  </section>;
}

export function Statistics({ stat, label, comparison }: { stat?: EquipmentGuideStat; label: string; comparison: string }) {
  if (!stat || !stat.items.length) return <div className={styles.empty}><span aria-hidden="true">◇</span><h2>{label}</h2><p>아직 충분한 장비 데이터가 없어요.</p><small>다른 부위를 확인하거나 잠시 후 다시 검색해 보세요.</small></div>;
  const top = stat.items[0];
  const part = EQUIPMENT_SLOTS.find(slot => slot.id === stat.slot)?.part ?? label;
  return <div>
    <div className={styles.detailHeading}><ItemIcon key={top.itemIcon} src={top.itemIcon} /><div><h2>{top.itemName}</h2><p>{label} · {stat.job} · {comparison}</p></div></div>
    <p className={styles.sample}>수집 표본 {stat.sampleCount.toLocaleString()}명 · {stat.updatedAt} 기준</p>
    {stat.sampleCount < MIN_SAMPLE_COUNT && <p role="status" className={styles.notice}>표본이 적어 참고용으로만 확인해주세요.</p>}
    <div className={styles.ratio}><span>사용 비율</span><strong>{top.ratio}<small>%</small></strong><p>수집한 부위 착용자 중 이 아이템을 사용하는 비율이에요.</p></div>
    <ItemRankingCarousel stat={stat} label={label} />
    <p className={styles.sample}>아래 강화·옵션은 {top.itemName} 착용자 {top.count}명 기준입니다. 동일한 퍼센트 옵션은 합산하며 방어율 무시는 개별 수치로 표시합니다.</p>
    <section className={styles.detailSection}><h3>스타포스</h3>{stat.starforceSupported === false ? <p className={styles.sample}>스타포스 적용 대상이 아닌 장비예요.</p> : <div className={styles.metrics}><span>평균 <strong>{stat.starforce.average ?? '—'}성</strong></span><span>중앙값 <strong>{stat.starforce.median ?? '—'}성</strong></span></div>}</section>
    {stat.potentialSupported === false ? <p className={styles.sample}>이 장비에는 잠재능력·에디셔널 잠재능력이 적용되지 않아요.</p> : <>
    <Distribution title="잠재능력" values={stat.potential} options={stat.potentialOptions} />
    <Distribution title="에디셔널 잠재능력" values={stat.additionalPotential} options={stat.additionalPotentialOptions} /></>}
    <Link className={styles.goalAction} href={goalLink(top, part)}>이 장비를 목표로 추가 →</Link><p className={styles.sample}>목표 화면에서 금액을 직접 입력해 주세요.</p>
  </div>;
}
