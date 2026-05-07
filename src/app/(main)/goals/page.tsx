'use client';

import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import { useSession } from 'next-auth/react';
import { useRecordStore } from '@/shared/lib/stores/useRecordStore';
import { useAuthStore } from '@/shared/lib/stores/useAuthStore';
import { useGoalStore } from '@/shared/lib/stores/useGoalStore';
import { useActiveCharacterId } from '@/shared/lib/hooks/useActiveCharacterId';
import { useStoredCharacterProfile } from '@/shared/lib/hooks/useStoredCharacterProfile';
import { useBossRevenueSummary } from '@/shared/lib/hooks/useBossRevenueSummary';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { formatDate, formatMeso, fromManInput, toManDisplay } from '@/shared/lib/utils/formatters';
import type { Goal, GoalTarget } from '@/shared/types';

const DEFAULT_EQUIPMENT_PART = '귀고리';

const JOB_GROUP_OPTIONS = [
  'all',
  'warrior',
  'magician',
  'bowman',
  'thief',
  'pirate',
] as const;

const EQUIPMENT_PART_OPTIONS = [
  '귀고리',
  '반지',
  '펜던트',
  '벨트',
  '훈장',
  '모자',
  '얼굴장식',
  '눈장식',
  '상의',
  '하의',
  '장갑',
  '신발',
  '망토',
  '어깨장식',
  '보조 무기',
  '엠블렘',
  '포켓 아이템',
  '기계심장',
  '펫장비',
] as const;

type EquipmentCatalogItem = {
  id: string;
  slug: string;
  name: string;
  slot: string;
  part: string;
  job_group: string | null;
  level: number | null;
  icon_url: string | null;
  source_url: string | null;
};

type EquipmentCatalogResponse = {
  items?: Array<{
    id?: string;
    slug?: string;
    name?: string;
    slot?: string;
    part?: string;
    job_group?: string | null;
    level?: number | null;
    icon_url?: string | null;
    source_url?: string | null;
  }>;
  parts?: string[];
  error?: string;
};

type GoalDraft = {
  id: string;
  kind: 'equipment' | 'meso';
  amountMan: string;
  equipmentPart: string;
  equipmentKey: string;
  equipmentName: string;
  equipmentSlot: string;
  equipmentIconUrl: string | null;
  equipmentShapeIconUrl: string | null;
};

type TargetView = GoalTarget & {
  priority: number;
  previousTargetTotal: number;
  cumulativeTarget: number;
  allocatedCurrent: number;
  isActive: boolean;
  goalId: string;
  goalStartStr: string;
};

function catalogItemKey(item: Pick<EquipmentCatalogItem, 'id' | 'slug'>) {
  return item.slug || item.id;
}

function CatalogThumb({ src, className }: { src: string | null; className: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <span className="text-[10px] text-t3">IMG</span>;
  }

  return <img src={src} alt="" className={className} onError={() => setFailed(true)} />;
}

function createDraft(kind: GoalDraft['kind'], equipment?: EquipmentCatalogItem | null): GoalDraft {
  return {
    id: crypto.randomUUID(),
    kind,
    amountMan: '',
    equipmentPart: equipment?.part ?? DEFAULT_EQUIPMENT_PART,
    equipmentKey: equipment ? catalogItemKey(equipment) : '',
    equipmentName: equipment?.name ?? '',
    equipmentSlot: equipment?.slot ?? '',
    equipmentIconUrl: equipment?.icon_url ?? null,
    equipmentShapeIconUrl: null,
  };
}

function normalizeCatalogItems(data: EquipmentCatalogResponse): EquipmentCatalogItem[] {
  return Array.isArray(data.items)
    ? data.items
        .map((item, index) => ({
          id: item.id || `${item.slug || item.slot || 'item'}-${index}`,
          slug: item.slug || item.id || `${item.slot || 'item'}-${index}`,
          slot: item.slot || '기타',
          part: item.part || DEFAULT_EQUIPMENT_PART,
          job_group: item.job_group ?? null,
          name: item.name || 'Unknown',
          level: typeof item.level === 'number' ? item.level : null,
          icon_url: item.icon_url ?? null,
          source_url: item.source_url ?? null,
        }))
        .filter((item) => !!item.name)
    : [];
}

function getElapsedDays(startDate: string) {
  const start = new Date(startDate);
  const diff = Date.now() - start.getTime();
  return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)) + 1);
}

function clampAllocation(current: number, previousTargetTotal: number, targetAmount: number) {
  return Math.max(Math.min(current - previousTargetTotal, targetAmount), 0);
}

function normalizeGoalCards(goals: Goal[]): Goal[] {
  return goals.filter(Boolean).sort((a, b) => {
    const positionDelta = (a.position ?? 0) - (b.position ?? 0);
    if (positionDelta !== 0) return positionDelta;
    const aTime = a.updated_at || a.created_at || '';
    const bTime = b.updated_at || b.created_at || '';
    return bTime.localeCompare(aTime);
  });
}

function targetLabel(target: GoalTarget) {
  if (target.kind === 'meso') return '메소';
  return target.equipment_slot || '장비';
}

function goalToDraft(goal: Goal): GoalDraft {
  const target = goal.targets?.[0] ?? (goal.meso_goal && goal.meso_goal > 0
    ? {
        id: goal.id,
        kind: 'meso' as const,
        title: '메소 목표',
        target_amount: goal.meso_goal,
      }
    : null);

  const equipmentKey = target && target.kind === 'equipment' && target.equipment_slot && target.equipment_name
    ? `${target.equipment_slot}::${target.equipment_name}`
    : '';

  return {
    id: goal.id,
    kind: target?.kind === 'meso' ? 'meso' : 'equipment',
    amountMan: toManDisplay(target?.target_amount ?? 0),
    equipmentPart: target?.equipment_part || target?.equipment_slot || DEFAULT_EQUIPMENT_PART,
    equipmentKey,
    equipmentName: target?.equipment_name || '',
    equipmentSlot: target?.equipment_slot || '',
    equipmentIconUrl: target?.equipment_icon_url || null,
    equipmentShapeIconUrl: target?.equipment_shape_icon_url || null,
  };
}

function deriveJobGroup(characterClass: string | null | undefined) {
  const normalized = (characterClass || '').trim();
  if (!normalized) return null;

  if (/비숍|아크메이지|썬콜|불독|배틀메이지|일리움|루미너스|키네시스|라라|린/i.test(normalized)) return 'magician';
  if (/히어로|팔라딘|다크나이트|소울마스터|미하일|아란|에반|카이저|데몬슬레이어|데몬어벤져|블래스터|제로|렌/i.test(normalized)) return 'warrior';
  if (/보우마스터|신궁|패스파인더|윈드브레이커|와일드헌터|메르세데스/i.test(normalized)) return 'bowman';
  if (/나이트로드|섀도어|듀얼블레이드|나이트워커|팬텀|카데나|호영|칼리/i.test(normalized)) return 'thief';
  if (/바이퍼|캡틴|캐논슈터|스트라이커|메카닉|엔젤릭버스터|카인|제논|아크/i.test(normalized)) return 'pirate';

  return null;
}

function jobGroupLabel(jobGroup: string) {
  switch (jobGroup) {
    case 'all':
      return '전체';
    case 'magician':
      return '마법사';
    case 'warrior':
      return '전사';
    case 'bowman':
      return '궁수';
    case 'thief':
      return '도적';
    case 'pirate':
      return '해적';
    default:
      return jobGroup;
  }
}

function TargetCard({
  target,
  onEdit,
  onDelete,
}: {
  target: TargetView;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const goal = target.target_amount;
  const pct = goal > 0 ? Math.min((target.allocatedCurrent / goal) * 100, 100) : 0;
  const remaining = Math.max(goal - target.allocatedCurrent, 0);
  const elapsedDays = getElapsedDays(target.goalStartStr);
  const start = new Date(target.goalStartStr);
  const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  const totalDays = Math.max(1, Math.floor((monthEnd.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  const expectedProgress = goal > 0 ? Math.min((elapsedDays / totalDays) * 100, 100) : 0;
  const onTrack = goal > 0 ? pct >= expectedProgress : false;

  let expectedDate: string | null = null;
  const dailyAvg = target.allocatedCurrent > 0 ? target.allocatedCurrent / elapsedDays : 0;
  if (remaining > 0 && dailyAvg > 0) {
    const d = new Date();
    d.setDate(d.getDate() + Math.ceil(remaining / dailyAvg));
    expectedDate = `${d.getMonth() + 1}월 ${d.getDate()}일`;
  }

  const icon = target.kind === 'meso'
    ? null
    : target.equipment_icon_url || target.equipment_shape_icon_url || null;

  return (
    <Card className="overflow-hidden p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex h-12 w-12 flex-none items-center justify-center overflow-hidden rounded-2xl ${target.kind === 'meso' ? 'bg-amber-500/15 text-amber-600' : 'bg-surface/70'}`}>
            {icon ? (
              <CatalogThumb key={icon} src={icon} className="h-11 w-11 object-contain" />
            ) : (
              <span className="text-sm font-black tracking-[0.18em]">MESO</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-t1">{target.title}</p>
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                {target.priority}순위
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-t3">
              {targetLabel(target)}{target.equipment_part ? ` · ${target.equipment_part}` : ''}
            </p>
          </div>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${onTrack ? 'bg-green-500/15 text-green-500' : 'bg-amber-500/15 text-amber-500'}`}>
          {target.isActive ? (onTrack ? '✓ 달성 예정' : '⚡ 진행 중') : '대기'}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-full border border-line bg-surface px-3 py-1.5 text-[11px] font-semibold text-t2 hover:border-amber-300 hover:text-t1"
        >
          수정
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-red-500 hover:border-red-300 hover:bg-red-100"
        >
          삭제
        </button>
      </div>

      <div className="mt-4 h-3 w-full rounded-full bg-surface p-0.5">
        <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-t3">
        <span>
          {formatMeso(target.allocatedCurrent)} / {formatMeso(goal)}
        </span>
        {remaining > 0 ? <span>남은 {formatMeso(remaining)}</span> : <span className="font-semibold text-amber-400">🎉 달성!</span>}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-t3">
        <span>누적 목표액 {formatMeso(target.cumulativeTarget)}</span>
        <span>이전 목표 {formatMeso(target.previousTargetTotal)}</span>
      </div>

      {expectedDate && remaining > 0 && target.isActive && (
        <p className="mt-2 text-xs text-t3">목표 설정일({target.goalStartStr}) 기준 달성 예상: {expectedDate}</p>
      )}

      {!target.isActive && (
        <p className="mt-2 text-xs text-t3">앞선 목표를 달성한 뒤 이 카드로 이어집니다.</p>
      )}
    </Card>
  );
}

function EquipmentCatalogPicker({
  draft,
  onUpdate,
  characterClass,
  compact = false,
}: {
  draft: GoalDraft;
  onUpdate: (patch: Partial<GoalDraft>) => void;
  characterClass?: string | null;
  compact?: boolean;
}) {
  const [catalogItems, setCatalogItems] = useState<EquipmentCatalogItem[]>([]);
  const [catalogParts, setCatalogParts] = useState<string[]>([...EQUIPMENT_PART_OPTIONS]);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [sortMode, setSortMode] = useState<'level' | 'name'>('level');
  const selectedPart = draft.equipmentPart || DEFAULT_EQUIPMENT_PART;
  const defaultJobGroup = useMemo(() => {
    if (draft.kind !== 'equipment') return null;
    return deriveJobGroup(characterClass);
  }, [characterClass, draft.kind]);
  const [selectedJobGroup, setSelectedJobGroup] = useState<string>('all');

  useEffect(() => {
    setSelectedJobGroup((current) => {
      if (current === 'all' || current === defaultJobGroup) {
        return defaultJobGroup ?? 'all';
      }
      return current;
    });
  }, [defaultJobGroup]);

  const partOptions = useMemo(
    () => Array.from(new Set([DEFAULT_EQUIPMENT_PART, ...EQUIPMENT_PART_OPTIONS, ...catalogParts])),
    [catalogParts],
  );

  useEffect(() => {
    if (draft.kind !== 'equipment') return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setCatalogLoading(true);
      setCatalogLoaded(false);
      setCatalogError('');
      try {
        const params = new URLSearchParams();
        params.set('part', selectedPart);
        if (selectedJobGroup !== 'all') {
          params.set('job', selectedJobGroup);
        }
        if (characterClass?.trim()) {
          params.set('class', characterClass.trim());
        }
        const trimmed = catalogQuery.trim();
        if (trimmed) params.set('q', trimmed);

        const res = await fetch(`/api/equipment-catalog?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = (await res.json().catch(() => ({}))) as EquipmentCatalogResponse;
        if (!res.ok) throw new Error(data.error || '장비 후보를 불러오지 못했습니다');

        setCatalogItems(normalizeCatalogItems(data));
        if (Array.isArray(data.parts) && data.parts.length > 0) {
          setCatalogParts(Array.from(new Set(data.parts.filter(Boolean))));
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setCatalogItems([]);
          setCatalogError(error instanceof Error ? error.message : '장비 후보를 불러오지 못했습니다');
        }
      } finally {
        if (!controller.signal.aborted) {
          setCatalogLoading(false);
          setCatalogLoaded(true);
        }
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [catalogQuery, characterClass, draft.kind, selectedJobGroup, selectedPart]);

  useEffect(() => {
    if (draft.kind !== 'equipment') return;
    if (draft.equipmentPart) return;
    onUpdate({
      equipmentPart: DEFAULT_EQUIPMENT_PART,
      equipmentKey: '',
      equipmentName: '',
      equipmentSlot: '',
      equipmentIconUrl: null,
      equipmentShapeIconUrl: null,
    });
  }, [draft.equipmentPart, draft.kind, onUpdate]);

  const selectedCatalogItem = useMemo(() => {
    const selected = catalogItems.find(
      (item) =>
        catalogItemKey(item) === draft.equipmentKey ||
        `${item.slot}::${item.name}` === draft.equipmentKey ||
        (item.name === draft.equipmentName && item.slot === draft.equipmentSlot),
    );

    if (selected) return selected;
    if (!draft.equipmentName) return null;

    return {
      id: draft.equipmentKey || `${draft.equipmentSlot}::${draft.equipmentName}`,
      slug: draft.equipmentKey || `${draft.equipmentSlot}::${draft.equipmentName}`,
      name: draft.equipmentName,
      slot: draft.equipmentSlot || selectedPart,
      part: draft.equipmentPart || selectedPart,
      job_group: null,
      level: null,
      icon_url: draft.equipmentIconUrl,
      source_url: null,
    };
  }, [catalogItems, draft.equipmentKey, draft.equipmentName, draft.equipmentPart, draft.equipmentIconUrl, draft.equipmentSlot, selectedPart]);
  const displayedItems = useMemo(() => {
    const items = [...catalogItems];
    if (sortMode === 'name') {
      return items.sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));
    }
    return items.sort((a, b) => {
      const levelDelta = (a.level ?? Number.MAX_SAFE_INTEGER) - (b.level ?? Number.MAX_SAFE_INTEGER);
      if (levelDelta !== 0) return levelDelta;
      return a.name.localeCompare(b.name, 'ko-KR');
    });
  }, [catalogItems, sortMode]);
  const controlClass = compact
    ? 'w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-t1 outline-none transition-colors focus:border-amber-400'
    : 'w-full rounded-2xl border border-line bg-card px-3 py-3 text-sm text-t1 outline-none transition-colors focus:border-amber-400';
  const labelClass = compact
    ? 'mb-1 block text-[10px] font-semibold text-t3'
    : 'mb-1 block text-[11px] font-semibold text-t3';

  return (
    <div>
      {draft.kind === 'equipment' ? (
        <div className={compact ? 'mt-2 space-y-2.5' : 'mt-3 space-y-3'}>
          <div>
            <label className={labelClass}>부위</label>
            <select
              value={selectedPart}
              onChange={(e) =>
                onUpdate({
                  equipmentPart: e.target.value,
                  equipmentKey: '',
                  equipmentName: '',
                  equipmentSlot: '',
                  equipmentIconUrl: null,
                  equipmentShapeIconUrl: null,
                })
              }
              className={controlClass}
            >
              {partOptions.map((part) => (
                <option key={part} value={part}>
                  {part}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>직업군</label>
            <select
              value={selectedJobGroup}
              onChange={(e) => setSelectedJobGroup(e.target.value)}
              className={controlClass}
            >
              {JOB_GROUP_OPTIONS.map((jobGroup) => (
                <option key={jobGroup} value={jobGroup}>
                  {jobGroupLabel(jobGroup)}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="검색"
            placeholder="예: 커맨더 포스 이어링"
            value={catalogQuery}
            onChange={(e) => setCatalogQuery(e.target.value)}
            className={compact ? 'rounded-xl px-3 py-2 text-sm' : undefined}
          />

          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-t3">정렬</p>
            <div className="inline-flex rounded-full border border-line bg-surface/70 p-1">
              <button
                type="button"
                onClick={() => setSortMode('level')}
                className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${sortMode === 'level' ? 'bg-amber-500 text-white' : 'text-t2'}`}
              >
                레벨순
              </button>
              <button
                type="button"
                onClick={() => setSortMode('name')}
                className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${sortMode === 'name' ? 'bg-amber-500 text-white' : 'text-t2'}`}
              >
                이름순
              </button>
            </div>
          </div>

          {catalogLoading && (
            <div className="rounded-2xl border border-dashed border-line px-4 py-5 text-center text-xs text-t3">
              장비 후보를 불러오는 중...
            </div>
          )}

          {catalogError && <p className="text-xs text-red-500">{catalogError}</p>}

          {!catalogLoading && catalogLoaded && catalogItems.length === 0 && !catalogError && (
            <div className="rounded-2xl border border-dashed border-line px-4 py-5 text-center text-xs text-t3">
              조건에 맞는 장비가 없어요. 검색어를 바꾸거나 부위를 다시 선택해보세요.
            </div>
          )}

          {displayedItems.length > 0 && (
            <div className="max-h-[260px] overflow-y-auto pr-1">
              <div className="grid gap-2 sm:grid-cols-2">
                {displayedItems.map((item) => {
                  const isSelected =
                    catalogItemKey(item) === draft.equipmentKey ||
                    `${item.slot}::${item.name}` === draft.equipmentKey ||
                    (item.name === draft.equipmentName && item.slot === draft.equipmentSlot);

                  return (
                    <button
                      key={catalogItemKey(item)}
                      type="button"
                      onClick={() =>
                        onUpdate({
                          equipmentPart: item.part || item.slot || selectedPart,
                          equipmentKey: catalogItemKey(item),
                          equipmentName: item.name,
                          equipmentSlot: item.slot,
                          equipmentIconUrl: item.icon_url ?? null,
                          equipmentShapeIconUrl: null,
                        })
                      }
                      className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors ${
                        isSelected
                          ? 'border-amber-400 bg-amber-50/70'
                          : 'border-line bg-card hover:border-amber-200 hover:bg-amber-50/40'
                      }`}
                    >
                      <div className="flex h-10 w-10 flex-none items-center justify-center overflow-hidden rounded-xl bg-surface">
                        <CatalogThumb key={item.icon_url || item.id} src={item.icon_url} className="h-9 w-9 object-contain" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-t1">{item.name}</p>
                        <p className="mt-0.5 text-[11px] text-t3">
                          {item.part}
                          {item.level ? ` · Lv.${item.level}` : ''}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {selectedCatalogItem && (
            <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface/45 px-3 py-3">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-card">
                <CatalogThumb key={selectedCatalogItem.icon_url || selectedCatalogItem.id} src={selectedCatalogItem.icon_url} className="h-11 w-11 object-contain" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-t1">{selectedCatalogItem.name}</p>
                <p className="mt-0.5 text-[11px] text-t3">
                  {selectedCatalogItem.slot}
                  {selectedCatalogItem.part ? ` · ${selectedCatalogItem.part}` : ''}
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className={compact ? 'mt-3 rounded-2xl border border-dashed border-line px-3 py-3 text-sm text-t3' : 'mt-3 rounded-2xl border border-dashed border-line px-3 py-4 text-sm text-t3'}>
          메소만 모으는 목표입니다.
        </div>
      )}
      <div className={compact ? 'mt-2' : 'mt-3'}>
        <Input
          label="예상 금액"
          placeholder="예: 20000"
          value={draft.amountMan}
          onChange={(e) => onUpdate({ amountMan: e.target.value.replace(/\D/g, '') })}
          suffix="만"
          inputMode="numeric"
          className={compact ? 'rounded-xl px-3 py-2 text-sm' : undefined}
        />
        {fromManInput(draft.amountMan) > 0 && (
          <p className="mt-1.5 ml-1 text-xs text-t3">= {formatMeso(fromManInput(draft.amountMan))}</p>
        )}
      </div>
    </div>
  );
}

function DraftCard({
  draft,
  onUpdate,
  onDelete,
  onSave,
  onCancel,
  index,
  characterClass,
  showDelete = true,
  compact = false,
  showActions = true,
}: {
  draft: GoalDraft;
  onUpdate: (patch: Partial<GoalDraft>) => void;
  onDelete: () => void;
  onSave: () => void;
  onCancel: () => void;
  index: number;
  characterClass?: string | null;
  showDelete?: boolean;
  compact?: boolean;
  showActions?: boolean;
}) {
  const shellClass = compact
    ? 'rounded-2xl border border-line bg-card/80 p-3 shadow-[0_8px_20px_rgba(148,111,66,0.04)]'
    : 'rounded-2xl border border-line bg-card/80 p-4 shadow-[0_8px_24px_rgba(148,111,66,0.05)]';

  return (
    <div className={shellClass}>
      <div className={compact ? 'mb-2 flex items-center justify-between gap-2' : 'mb-3 flex items-center justify-between gap-2'}>
        <div className="inline-flex rounded-full border border-line bg-surface/60 p-1">
          <button
            type="button"
            onClick={() => onUpdate({ kind: 'equipment' })}
            className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${draft.kind === 'equipment' ? 'bg-amber-500 text-white' : 'text-t2'}`}
          >
            장비
          </button>
          <button
            type="button"
            onClick={() => onUpdate({ kind: 'meso', equipmentKey: '', equipmentName: '', equipmentSlot: '', equipmentIconUrl: null, equipmentShapeIconUrl: null })}
            className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${draft.kind === 'meso' ? 'bg-amber-500 text-white' : 'text-t2'}`}
          >
            메소
          </button>
        </div>
        {showActions && (
          <div className="flex items-center gap-1.5">
            <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-600">
              {index + 1}순위
            </span>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-line bg-surface px-2 py-1 text-[10px] font-semibold text-t2"
            >
              취소
            </button>
            <button
              type="button"
              onClick={onSave}
              className="rounded-full border border-amber-300 bg-amber-500 px-3 py-1 text-[10px] font-semibold text-white"
            >
              저장
            </button>
            {showDelete && (
              <button type="button" onClick={onDelete} className="text-[11px] font-semibold text-red-400 hover:text-red-500">
                삭제
              </button>
            )}
          </div>
        )}
      </div>

      <EquipmentCatalogPicker draft={draft} onUpdate={onUpdate} characterClass={characterClass} compact={compact} />
    </div>
  );
}

export default function GoalsPage() {
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user?.id;
  const { localOwnerId, initializeLocal } = useAuthStore();
  const { records, loadRecords } = useRecordStore();
  const { currentGoals, loadGoal, saveGoals, error: goalError, clearError } = useGoalStore();
  const activeCharacterId = useActiveCharacterId();
  const profile = useStoredCharacterProfile();

  const [draftGoals, setDraftGoals] = useState<GoalDraft[]>([]);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [creatingGoalDraft, setCreatingGoalDraft] = useState<GoalDraft | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [draggingGoalId, setDraggingGoalId] = useState<string | null>(null);
  const [dragOverGoalId, setDragOverGoalId] = useState<string | null>(null);

  useEffect(() => {
    initializeLocal();
  }, [initializeLocal]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (localOwnerId) {
      loadRecords(localOwnerId, isLoggedIn, activeCharacterId);
      loadGoal(localOwnerId, isLoggedIn);
    }
  }, [localOwnerId, loadRecords, loadGoal, isLoggedIn, activeCharacterId]);

  const today = useMemo(() => new Date(), []);
  const monthStart = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), [today]);

  const todayStr = useMemo(() => formatDate(today), [today]);
  const bossWeeklySummary = useBossRevenueSummary(monthStart, today, isLoggedIn, 'weekly');
  const bossMonthlySummary = useBossRevenueSummary(monthStart, today, isLoggedIn, 'monthly');

  const scopedRecords = useMemo(
    () => records.filter((r) => r.date <= todayStr),
    [records, todayStr],
  );

  const totalHunting = scopedRecords.reduce((sum, r) => sum + r.net_revenue, 0);
  const totalBoss = bossWeeklySummary.totalRevenue + bossMonthlySummary.totalRevenue;
  const totalCurrent = totalHunting + totalBoss;

  const goalCards = useMemo(() => normalizeGoalCards(currentGoals), [currentGoals]);
  const totalTargetAmount = useMemo(
    () => goalCards.reduce((sum, goal) => {
      const target = goal.targets?.[0] ?? (goal.meso_goal && goal.meso_goal > 0
        ? {
            id: goal.id,
            kind: 'meso' as const,
            title: '메소 목표',
            target_amount: goal.meso_goal,
          }
        : null);
      return sum + (target?.target_amount ?? 0);
    }, 0),
    [goalCards],
  );
  const progressPct = totalTargetAmount > 0 ? Math.min((totalCurrent / totalTargetAmount) * 100, 100) : 0;
  const targetViews = useMemo<TargetView[]>(
    () => {
      let runningTotal = 0;
      return goalCards.flatMap((goal, index) => {
        const target = goal.targets?.[0] ?? (goal.meso_goal && goal.meso_goal > 0
          ? {
              id: goal.id,
              kind: 'meso' as const,
              title: '메소 목표',
              target_amount: goal.meso_goal,
            }
          : null);
        if (!target) return [];
        const previousTargetTotal = runningTotal;
        const allocatedCurrent = clampAllocation(totalCurrent, previousTargetTotal, target.target_amount);
        runningTotal += target.target_amount;
        return {
          ...target,
          goalId: goal.id,
          goalStartStr: formatDate(new Date(goal.created_at)),
          priority: index + 1,
          previousTargetTotal,
          cumulativeTarget: runningTotal,
          allocatedCurrent,
          isActive: totalCurrent > previousTargetTotal,
        };
      });
    },
    [goalCards, totalCurrent],
  );

  const currentCharacterLabel = useMemo(() => {
    if (!profile) return '현재 캐릭터';
    return `${profile.character_name} · ${profile.character_class ?? '직업 미상'}${profile.character_level ? ` Lv.${profile.character_level}` : ''}`;
  }, [profile]);

  useEffect(() => {
    if (editingGoalId || creatingGoalDraft) return;
    setDraftGoals(goalCards.map((goal) => goalToDraft(goal)));
  }, [creatingGoalDraft, editingGoalId, goalCards]);

  const addDraft = (kind: GoalDraft['kind']) => {
    setFormError('');
    if (editingGoalId || creatingGoalDraft) return;
    setCreatingGoalDraft(createDraft(kind));
  };

  const updateDraft = (id: string, patch: Partial<GoalDraft>) => {
    setDraftGoals((prev) => prev.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)));
  };

  const startEdit = (goalId: string) => {
    setFormError('');
    setEditingGoalId(goalId);
  };

  const closeCreateGoal = () => {
    setCreatingGoalDraft(null);
    setFormError('');
  };

  const persistGoals = async (nextDraftGoals: GoalDraft[], focusDraftId?: string) => {
    clearError();
    setFormError('');

    if (!localOwnerId) {
      setFormError('사용자 초기화 중입니다. 잠시 후 다시 시도해주세요.');
      return false;
    }

    if (nextDraftGoals.length === 0) {
      setSaving(true);
      try {
        await saveGoals([], localOwnerId, isLoggedIn);
      } finally {
        setSaving(false);
      }
      setEditingGoalId(null);
      return true;
    }

    const nextGoals: Goal[] = [];
    for (const draft of nextDraftGoals) {
      const amount = fromManInput(draft.amountMan);
      if (!amount) {
        if (!focusDraftId || draft.id === focusDraftId) {
          setFormError('예상 금액을 입력해주세요.');
          return false;
        }
        continue;
      }

      const target =
        draft.kind === 'meso'
          ? {
              id: draft.id,
              kind: 'meso' as const,
              title: '메소 목표',
              target_amount: amount,
            }
          : (() => {
              if (!draft.equipmentName || !draft.equipmentSlot) {
                if (!focusDraftId || draft.id === focusDraftId) {
                  setFormError('장비 목표는 장비를 선택해야 해요.');
                }
                return null;
              }
              return {
                id: draft.id,
                kind: 'equipment' as const,
                title: draft.equipmentName,
                target_amount: amount,
                equipment_name: draft.equipmentName,
                equipment_slot: draft.equipmentSlot,
                equipment_icon_url: draft.equipmentIconUrl,
                equipment_shape_icon_url: draft.equipmentShapeIconUrl,
                equipment_part: draft.equipmentPart || null,
              };
            })();

      if (!target) return false;

      const existingGoal = goalCards.find((goal) => goal.id === draft.id);
      nextGoals.push({
        id: draft.id,
        local_owner_id: localOwnerId,
        position: nextGoals.length,
        meso_goal: target.target_amount,
        shard_goal: undefined,
        time_goal_minutes: undefined,
        targets: [target],
        created_at: existingGoal?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    if (nextGoals.length === 0) {
      setFormError('예상 금액을 입력한 목표가 하나도 없습니다.');
      return false;
    }

    setSaving(true);
    try {
      await saveGoals(nextGoals, localOwnerId, isLoggedIn);
      setEditingGoalId(null);
      return true;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (draftId?: string) => {
    await persistGoals(draftGoals, draftId);
  };

  const handleCreateGoal = async () => {
    if (!creatingGoalDraft) return;
    const nextDrafts = [...draftGoals, creatingGoalDraft];
    const saved = await persistGoals(nextDrafts, creatingGoalDraft.id);
    if (saved) {
      setDraftGoals(nextDrafts);
      setCreatingGoalDraft(null);
    }
  };

  const handleCancel = () => {
    setDraftGoals(goalCards.map((goal) => goalToDraft(goal)));
    setEditingGoalId(null);
    setFormError('');
  };

  const reorderDraftGoals = async (fromId: string, toId: string, placement: 'before' | 'after' = 'before') => {
    if (fromId === toId || saving || !!editingGoalId || !!creatingGoalDraft) return;

    const fromIndex = draftGoals.findIndex((draft) => draft.id === fromId);
    const toIndex = draftGoals.findIndex((draft) => draft.id === toId);
    if (fromIndex < 0 || toIndex < 0) return;

    const nextDrafts = [...draftGoals];
    const [moved] = nextDrafts.splice(fromIndex, 1);
    const targetIndex = nextDrafts.findIndex((draft) => draft.id === toId);
    if (targetIndex < 0) return;

    const insertIndex = placement === 'after' ? targetIndex + 1 : targetIndex;
    nextDrafts.splice(insertIndex, 0, moved);

    setDraftGoals(nextDrafts);
    setDraggingGoalId(null);
    setDragOverGoalId(null);

    const saved = await persistGoals(nextDrafts);
    if (!saved) {
      setDraftGoals(goalCards.map((goal) => goalToDraft(goal)));
    }
  };

  const handleGoalDragStart = (goalId: string) => (event: DragEvent<HTMLElement>) => {
    if (saving || !!editingGoalId || !!creatingGoalDraft) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', goalId);
    setDraggingGoalId(goalId);
  };

  const handleGoalDragOver = (goalId: string) => (event: DragEvent<HTMLElement>) => {
    if (saving || !!editingGoalId || !!creatingGoalDraft || !draggingGoalId || draggingGoalId === goalId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    const rect = event.currentTarget.getBoundingClientRect();
    const placement = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    setDragOverGoalId(`${goalId}:${placement}`);
  };

  const handleGoalDrop = (goalId: string) => async (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (saving || !!editingGoalId || !!creatingGoalDraft) return;

    const dataTransferId = event.dataTransfer.getData('text/plain');
    const fromId = draggingGoalId || dataTransferId;
    if (!fromId || fromId === goalId) {
      setDraggingGoalId(null);
      setDragOverGoalId(null);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const placement = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    await reorderDraftGoals(fromId, goalId, placement);
  };

  const handleGoalDragEnd = () => {
    setDraggingGoalId(null);
    setDragOverGoalId(null);
  };

  const handleDeleteGoal = async (id: string) => {
    const nextDrafts = draftGoals.filter((draft) => draft.id !== id);
    setDraftGoals(nextDrafts);
    if (editingGoalId === id) {
      setEditingGoalId(null);
    }
    await persistGoals(nextDrafts);
  };

  const createGoalModal =
    creatingGoalDraft && isMounted
      ? createPortal(
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 px-3 py-6 backdrop-blur-[2px]">
            <div className="w-full max-w-[480px] my-auto">
              <Card className="max-h-[calc(100vh-3rem)] overflow-hidden p-0 shadow-[0_24px_80px_rgba(0,0,0,0.25)]">
                <div className="flex max-h-[calc(100vh-3rem)] flex-col">
                  <div className="shrink-0 border-b border-line/70 px-4 py-3">
                    <p className="text-xs font-semibold text-amber-600">새 목표 카드</p>
                    <h2 className="mt-1 text-sm font-bold text-t1">
                      {creatingGoalDraft.kind === 'equipment' ? '장비 카드 추가' : '메소 카드 추가'}
                    </h2>
                    <p className="mt-1 text-[11px] text-t3">이 카드만 입력하고 저장하면 목록에 한 장씩 쌓입니다.</p>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                    {formError && <p className="mb-3 text-xs text-red-500">{formError}</p>}

                    <DraftCard
                      draft={creatingGoalDraft}
                      onUpdate={(patch) => setCreatingGoalDraft((prev) => (prev ? { ...prev, ...patch } : prev))}
                      onDelete={() => {}}
                      onSave={handleCreateGoal}
                      onCancel={closeCreateGoal}
                      characterClass={profile?.character_class ?? null}
                      index={draftGoals.length}
                      showDelete={false}
                      showActions={false}
                      compact
                    />
                  </div>

                  <div className="shrink-0 border-t border-line/70 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="secondary" size="sm" onClick={closeCreateGoal} disabled={saving}>
                        취소
                      </Button>
                      <Button size="sm" onClick={handleCreateGoal} disabled={saving}>
                        {saving ? '저장 중...' : '저장'}
                      </Button>
                    </div>
                  </div>
                </div>
            </Card>
          </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
    <main className="maple-fade-up px-4 pt-6 pb-4 md:relative md:left-1/2 md:w-[760px] md:max-w-none md:-translate-x-1/2 md:px-0">
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="maple-title text-2xl font-bold text-t1">목표</h1>
            <p className="mt-1 text-xs text-t3">{currentCharacterLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => addDraft('equipment')} disabled={!!editingGoalId || !!creatingGoalDraft || saving}>
              + 장비 카드
            </Button>
            <Button variant="secondary" size="sm" onClick={() => addDraft('meso')} disabled={!!editingGoalId || !!creatingGoalDraft || saving}>
              + 메소 카드
            </Button>
          </div>
        </div>

        <section className="flex min-w-0 flex-col gap-5">
          <Card className="border-amber-500/20 bg-[linear-gradient(130deg,rgba(245,158,11,0.13),rgba(245,158,11,0.03)_55%,transparent)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] text-t3">목표 현황</p>
                <p className="mt-1 text-2xl font-black tracking-tight text-t1">목표 카드를 하나씩 쌓아갑니다</p>
                <p className="mt-2 text-xs text-t3">카드 추가 버튼으로 목표를 한 장씩 만들고, 각 카드에서 바로 수정과 삭제를 할 수 있어요.</p>
                <p className="mt-1 text-xs font-medium text-amber-600">드래그해서 우선순위를 변경할 수 있어요.</p>
              </div>
              <div className="grid min-w-[220px] grid-cols-2 gap-2">
                <div className="rounded-2xl border border-line bg-card/80 p-3">
                  <p className="text-[11px] text-t3">총 목표액</p>
                  <p className="mt-1 text-base font-bold text-t1">{formatMeso(totalTargetAmount)}</p>
                </div>
                <div className="rounded-2xl border border-line bg-card/80 p-3">
                  <p className="text-[11px] text-t3">목표 진행</p>
                  <p className="mt-1 text-base font-bold text-t1">{progressPct.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          </Card>

          {formError && <p className="text-xs text-red-500">{formError}</p>}
          {goalError && <p className="text-xs text-red-500">{goalError}</p>}

          {goalCards.length === 0 && draftGoals.length === 0 && (
            <Card className="border-amber-500/20 bg-[linear-gradient(130deg,rgba(245,158,11,0.18),rgba(245,158,11,0.04)_55%,transparent)] py-10">
              <div className="flex flex-col items-center gap-4 text-center">
                <p className="text-4xl">🎯</p>
                <p className="text-sm text-t2">장비 목표와 메소 목표를 카드로 모아둘 수 있어요.</p>
                <div className="flex gap-2">
                  <Button onClick={() => addDraft('equipment')} disabled={saving || !!editingGoalId || !!creatingGoalDraft}>+ 장비 카드</Button>
                  <Button variant="secondary" onClick={() => addDraft('meso')} disabled={saving || !!editingGoalId || !!creatingGoalDraft}>+ 메소 카드</Button>
                </div>
              </div>
            </Card>
          )}

          {draftGoals.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {draftGoals.map((draft, index) => {
                const targetView = targetViews.find((target) => target.goalId === draft.id);
                const isEditingCard = editingGoalId === draft.id || !targetView;
                const isDragging = draggingGoalId === draft.id;
                const dragHintBefore = dragOverGoalId === `${draft.id}:before`;
                const dragHintAfter = dragOverGoalId === `${draft.id}:after`;
                const dragLocked = !!creatingGoalDraft || !!editingGoalId || saving;

                return (
                  <div
                    key={draft.id}
                    draggable={!dragLocked}
                    onDragStart={handleGoalDragStart(draft.id)}
                    onDragOver={handleGoalDragOver(draft.id)}
                    onDrop={handleGoalDrop(draft.id)}
                    onDragEnd={handleGoalDragEnd}
                    className={[
                      'relative rounded-2xl transition-all',
                      dragLocked ? '' : 'cursor-grab active:cursor-grabbing',
                      isDragging ? 'opacity-60 scale-[0.98]' : '',
                      dragHintBefore ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-app' : '',
                      dragHintAfter ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-app' : '',
                    ].join(' ')}
                  >
                    

                    {!isEditingCard && targetView ? (
                      <TargetCard
                        target={targetView}
                        onEdit={() => startEdit(draft.id)}
                        onDelete={() => void handleDeleteGoal(draft.id)}
                      />
                    ) : (
                      <DraftCard
                        index={index}
                        draft={draft}
                        onUpdate={(patch) => updateDraft(draft.id, patch)}
                        onDelete={() => void handleDeleteGoal(draft.id)}
                        onSave={() => void handleSave(draft.id)}
                        onCancel={handleCancel}
                        characterClass={profile?.character_class ?? null}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
    {createGoalModal}
    </>
  );
}
