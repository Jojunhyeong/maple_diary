'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type { EquipmentGuideLoadout, EquipmentGuideLoadoutItem, EquipmentSlotId, OwnEquipment } from './model';
import { EQUIPMENT_SLOTS } from './model';
import styles from './styles.module.css';

type RawEquipment = Record<string, unknown>;
type TooltipStat = { label: string; total: string; parts: Array<{ value: string; tone: 'base' | 'add' | 'etc' | 'star' | 'exceptional' }> };
type TooltipCardProps = {
  badge: string;
  name: string;
  icon?: string | null;
  part: string;
  starforce?: number;
  potentialGrade?: string;
  potentialLines: string[];
  additionalGrade?: string;
  additionalLines: string[];
  stats?: TooltipStat[];
  cuttableCount?: number;
  footer?: string;
  goalHref?: string;
};

const STAT_FIELDS = [
  ['str', 'STR'], ['dex', 'DEX'], ['int', 'INT'], ['luk', 'LUK'],
  ['max_hp', '최대 HP'], ['max_mp', '최대 MP'], ['attack_power', '공격력'], ['magic_power', '마력'],
  ['boss_damage', '보스 몬스터 데미지'], ['ignore_monster_armor', '몬스터 방어율 무시'], ['all_stat', '올스탯'],
] as const;

export function Compare({ characterName, selectedSlot, recommended }: { characterName?: string; selectedSlot: EquipmentSlotId; recommended: { loadout: EquipmentGuideLoadout; item: EquipmentGuideLoadoutItem } }) {
  const query = useQuery({
    queryKey: ['equipment-guide-own-equipment', characterName],
    enabled: !!characterName,
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/maple/character-equipment?name=' + encodeURIComponent(characterName!), { signal });
      if (!response.ok) throw new Error('장비 정보를 불러오지 못했어요.');
      return await response.json() as { items: OwnEquipment[]; equipment_preset_no?: number | null };
    },
  });
  const slot = EQUIPMENT_SLOTS.find(item => item.id === selectedSlot);
  const part = slot?.part ?? '장비';
  const own = query.data?.items.find(item => item.slot === slot?.apiSlot);
  const ownStarforce = readNumber(own?.raw, 'starforce');
  const recommendedStarforce = recommended.item.starforce;
  const difference = ownStarforce !== undefined && recommendedStarforce !== undefined ? ownStarforce - recommendedStarforce : null;
  const goalParams = new URLSearchParams({ guideItem: recommended.item.itemName, guidePart: part });

  return <section className={styles.compare}>
    <div className={styles.compareHeader}>
      <div><p className={styles.eyebrow}>장비 비교</p><h2>{slot?.label}</h2><p>{characterName}의 장비와 전투력 {formatPower(recommended.loadout.power)} 추천 세팅을 비교해요.</p></div>
      {difference !== null && <span className={styles.starDifference}>{difference === 0 ? '스타포스 동일' : `내 장비가 ${Math.abs(difference)}성 ${difference > 0 ? '높음' : '낮음'}`}</span>}
    </div>
    {query.data?.equipment_preset_no && <p className={styles.presetNotice}>드롭률·메소 획득량 잠재가 없는 장비 프리셋 {query.data.equipment_preset_no}번 기준</p>}
    {!characterName ? <p>캐릭터를 선택하면 내 장비를 함께 확인할 수 있어요. <Link href="/settings">캐릭터 선택 →</Link></p>
      : query.isPending ? <CompareSkeleton />
      : query.isError ? <p role="alert">{query.error.message} <button onClick={() => void query.refetch()}>다시 시도</button></p>
      : !own ? <p>{characterName}의 해당 부위 장비 정보가 없어요.</p>
      : <div className={styles.tooltipCompareGrid}>
        <EquipmentTooltipCard badge="내 장비" name={itemDisplayName(own.name, own.raw)} icon={own.icon_url} part={part} starforce={ownStarforce}
          potentialGrade={readText(own.raw, 'potential_option_grade')} potentialLines={potentialLines(own.raw)}
          additionalGrade={readText(own.raw, 'additional_potential_option_grade')} additionalLines={potentialLines(own.raw, true)}
          stats={totalStats(own.raw)} cuttableCount={readNumber(own.raw, 'cuttable_count')} footer={`${characterName} · 현재 장착 장비`} />
        <EquipmentTooltipCard badge="추천 세팅" name={itemDisplayName(recommended.item.itemName, recommended.item.raw)} icon={recommended.item.itemIcon} part={part} starforce={recommendedStarforce}
          potentialGrade={recommended.item.potentialGrade} potentialLines={recommended.item.raw ? potentialLines(recommended.item.raw) : splitOptions(recommended.item.potentialOption)}
          additionalGrade={recommended.item.additionalPotentialGrade} additionalLines={recommended.item.raw ? potentialLines(recommended.item.raw, true) : splitOptions(recommended.item.additionalPotentialOption)}
          stats={totalStats(recommended.item.raw)} cuttableCount={readNumber(recommended.item.raw, 'cuttable_count')}
          footer={`전투력 ${formatPower(recommended.loadout.power)} 실제 캐릭터 장비`} goalHref={`/goals?${goalParams.toString()}`} />
      </div>}
  </section>;
}

function EquipmentTooltipCard({ badge, name, icon, part, starforce, potentialGrade, potentialLines, additionalGrade, additionalLines, stats = [], cuttableCount, footer, goalHref }: TooltipCardProps) {
  const grade = gradeKey(potentialGrade);
  return <article className={styles.mapleTooltip}>
    <div className={styles.tooltipTopbar}><span aria-hidden="true">☆</span><strong>{badge}</strong><span aria-hidden="true">▦</span></div>
    <Starforce value={starforce} />
    <h3>{name}</h3>
    <p className={styles.itemGrade} data-grade={grade}>({potentialGrade ? `${potentialGrade} 아이템` : '잠재등급 정보 없음'})</p>
    <div className={styles.tooltipDivider} />
    <div className={styles.tooltipIconStage}>
      <div className={styles.tooltipIcon} data-grade={grade}>{icon
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={icon} alt="" /> : <span aria-hidden="true">◇</span>}</div>
    </div>
    <div className={styles.tooltipDivider} />
    <p className={styles.tooltipPart}>장비분류 : <strong>{part}</strong></p>
    {stats.length > 0 && <section className={styles.tooltipStats}>{stats.map(stat => <p key={stat.label}><span>{stat.label} : <strong>{stat.total}</strong></span>{stat.parts.length > 0 && <small>( {stat.parts.map((part, index) => <em key={`${part.tone}-${index}`} data-tone={part.tone}>{part.value}</em>)} )</small>}</p>)}</section>}
    {cuttableCount !== undefined && cuttableCount > 0 && <p className={styles.tooltipCuttable}>가위 사용 가능 횟수 : {cuttableCount}회</p>}
    <PotentialSection title="잠재옵션" grade={potentialGrade} lines={potentialLines} />
    <PotentialSection title="에디셔널 잠재옵션" grade={additionalGrade} lines={additionalLines} additional />
    <p className={styles.tooltipFooter}>{footer}</p>
    {goalHref && <Link className={styles.tooltipGoal} href={goalHref}>이 장비를 목표로 추가</Link>}
  </article>;
}

function Starforce({ value }: { value?: number }) {
  if (value === undefined) return <p className={styles.noStarforce}>스타포스 정보 없음</p>;
  const active = Math.max(0, Math.min(25, Math.round(value)));
  return <div className={styles.tooltipStars} aria-label={`스타포스 ${value}성`}>{Array.from({ length: 25 }, (_, index) => <span key={index} data-active={index < active}>{index < active ? '★' : '☆'}</span>)}</div>;
}

function PotentialSection({ title, grade, lines, additional = false }: { title: string; grade?: string; lines: string[]; additional?: boolean }) {
  const key = gradeKey(grade);
  return <section className={styles.tooltipPotential} data-additional={additional || undefined}>
    <h4 data-grade={key}><span aria-hidden="true">{additional ? 'A' : 'P'}</span>{title}{grade ? ` · ${grade}` : ''}</h4>
    {lines.length ? lines.map((line, index) => <p key={`${line}-${index}`}>{line}</p>) : <p className={styles.tooltipMuted}>옵션 정보 없음</p>}
  </section>;
}

function CompareSkeleton() {
  return <div className={styles.tooltipCompareGrid} aria-label="내 장비 불러오는 중"><div className={styles.tooltipSkeleton} /><div className={styles.tooltipSkeleton} /></div>;
}

function readText(raw: RawEquipment | undefined, key: string) {
  const value = raw?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readNumber(raw: RawEquipment | undefined, key: string) {
  const value = Number(raw?.[key]);
  return Number.isFinite(value) && raw?.[key] !== '' && raw?.[key] !== null && raw?.[key] !== undefined ? value : undefined;
}

function potentialLines(raw: RawEquipment | undefined, additional = false) {
  const prefix = additional ? 'additional_potential_option_' : 'potential_option_';
  return [1, 2, 3].flatMap(index => {
    const value = readText(raw, `${prefix}${index}`);
    return value ? [value] : [];
  });
}

function splitOptions(value?: string) {
  return value && value !== '옵션 없음' ? value.split(' · ').map(line => line.trim()).filter(Boolean) : [];
}

function totalStats(raw: RawEquipment | undefined) {
  const total = raw?.item_total_option;
  if (!total || typeof total !== 'object' || Array.isArray(total)) return [];
  const options = total as Record<string, unknown>;
  const sources = [
    ['item_base_option', 'base', true], ['item_starforce_option', 'star', false],
    ['item_etc_option', 'etc', false], ['item_add_option', 'add', false],
    ['item_exceptional_option', 'exceptional', false],
  ] as const;
  return STAT_FIELDS.flatMap(([key, label]) => {
    const value = Number(options[key]);
    if (!Number.isFinite(value) || value === 0) return [];
    const suffix = key === 'boss_damage' || key === 'ignore_monster_armor' || key === 'all_stat' ? '%' : '';
    const parts = sources.flatMap(([source, tone, showZero]) => {
      const group = raw?.[source];
      if (!group || typeof group !== 'object' || Array.isArray(group)) return [];
      const partValue = Number((group as Record<string, unknown>)[key]);
      return Number.isFinite(partValue) && (showZero || partValue !== 0)
        ? [{ value: `${partValue > 0 ? '+' : ''}${partValue}${suffix}`, tone }]
        : [];
    });
    return [{ label, total: `${value > 0 ? '+' : ''}${value}${suffix}`, parts }];
  });
}

function itemDisplayName(name: string, raw: RawEquipment | undefined) {
  const upgrade = readNumber(raw, 'scroll_upgrade');
  return upgrade && upgrade > 0 ? `${name} (+${upgrade})` : name;
}

function gradeKey(grade?: string) {
  if (grade?.includes('레전드리')) return 'legendary';
  if (grade?.includes('유니크')) return 'unique';
  if (grade?.includes('에픽')) return 'epic';
  if (grade?.includes('레어')) return 'rare';
  return 'normal';
}

function formatPower(value: number) {
  return value >= 100_000_000 ? `${Math.round(value / 1_000_000) / 100}억` : `${Math.round(value / 1_000_000)}백만`;
}
