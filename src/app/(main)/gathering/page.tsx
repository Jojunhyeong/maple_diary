'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { useActiveCharacterId } from '@/shared/lib/hooks/useActiveCharacterId';
import { formatDate, formatDateKorean, formatMeso, formatNumber } from '@/shared/lib/utils/formatters';
import {
  useGatheringRevenueMutations,
  useGatheringRevenuesQuery,
} from '@/shared/lib/queries/useGatheringRevenuesQuery';

type GatheringTabKey = 'favorite' | 'seed' | 'flower' | 'ore';

type GatheringItem = {
  id: string;
  label: string;
  tab: Exclude<GatheringTabKey, 'favorite'>;
  imageUrl?: string;
};

type GatheringRow = {
  id: string;
  label: string;
  quantity: string;
  unitPrice: string;
  tab: Exclude<GatheringTabKey, 'favorite'>;
};

type SavedGatheringRevenue = {
  id: string;
  date: string;
  item_name: string;
  item_tab: Exclude<GatheringTabKey, 'favorite'>;
  quantity: number;
  unit_price: number;
  total_amount: number;
  created_at: string;
  updated_at: string;
};

type RecordSummary = {
  total: number;
  count: number;
  byTab: Record<Exclude<GatheringTabKey, 'favorite'>, number>;
};

type TabTone = {
  labelClass: string;
  badgeClass: string;
  softClass: string;
};

const TABS: Array<{ key: GatheringTabKey; label: string; subtitle: string }> = [
  { key: 'favorite', label: '즐겨찾기', subtitle: '자주 쓰는 전리품' },
  { key: 'seed', label: '씨앗', subtitle: '식물 채집' },
  { key: 'flower', label: '꽃', subtitle: '꽃 채집' },
  { key: 'ore', label: '원석', subtitle: '광물 채광' },
];

const ITEMS: Record<Exclude<GatheringTabKey, 'favorite'>, GatheringItem[]> = {
  seed: [
    { id: 'juniperberry-seed', label: '쥬니퍼베리 씨앗', tab: 'seed', imageUrl: 'https://media.maplestorywiki.net/yetidb/Etc_Juniper_Berry_Seed.png' },
    { id: 'marjoram-seed', label: '마조람 씨앗', tab: 'seed', imageUrl: 'https://media.maplestorywiki.net/yetidb/Etc_Marjoram_Seed.png' },
    { id: 'lavender-seed', label: '라벤더 씨앗', tab: 'seed', imageUrl: 'https://media.maplestorywiki.net/yetidb/Etc_Lavender_Seed.png' },
    { id: 'rosemary-seed', label: '로즈마리 씨앗', tab: 'seed', imageUrl: 'https://media.maplestorywiki.net/yetidb/Etc_Rosemary_Seed.png' },
    { id: 'mandarin-seed', label: '만다린 씨앗', tab: 'seed', imageUrl: 'https://media.maplestorywiki.net/yetidb/Etc_Mandarin_Seed.png' },
    { id: 'lemon-balm-seed', label: '레몬밤 씨앗', tab: 'seed', imageUrl: 'https://media.maplestorywiki.net/yetidb/Etc_Lemon_Balm_Seed.png' },
    { id: 'jasmine-seed', label: '자스민 씨앗', tab: 'seed', imageUrl: 'https://media.maplestorywiki.net/yetidb/Etc_Jasmine_Seed.png' },
    { id: 'tea-tree-seed', label: '티트리 씨앗', tab: 'seed', imageUrl: 'https://media.maplestorywiki.net/yetidb/Etc_Tea_Tree_Seed.png' },
    { id: 'chamomile-seed', label: '카모마일 씨앗', tab: 'seed', imageUrl: 'https://media.maplestorywiki.net/yetidb/Etc_Chamomile_Seed.png' },
    { id: 'patchouli-seed', label: '페츌리 씨앗', tab: 'seed', imageUrl: 'https://media.maplestorywiki.net/yetidb/Etc_Patchouli_Seed.png' },
  ],
  flower: [
    { id: 'juniperberry-flower', label: '쥬니퍼베리 꽃', tab: 'flower', imageUrl: 'https://media.maplestorywiki.net/yetidb/Etc_Juniper_Berry_Flower.png' },
    { id: 'marjoram-flower', label: '마조람 꽃', tab: 'flower', imageUrl: 'https://media.maplestorywiki.net/yetidb/Etc_Marjoram_Flower.png' },
    { id: 'lavender-flower', label: '라벤더 꽃', tab: 'flower', imageUrl: 'https://media.maplestorywiki.net/yetidb/Etc_Lavender_Flower.png' },
    { id: 'rosemary-flower', label: '로즈마리 꽃', tab: 'flower', imageUrl: 'https://media.maplestorywiki.net/yetidb/Etc_Rosemary_Flower.png' },
    { id: 'mandarin-flower', label: '만다린 꽃', tab: 'flower', imageUrl: 'https://media.maplestorywiki.net/yetidb/Etc_Mandarin_Flower.png' },
    { id: 'lemon-balm-flower', label: '레몬밤 꽃', tab: 'flower', imageUrl: 'https://media.maplestorywiki.net/yetidb/Etc_Lemon_Balm_Flower.png' },
    { id: 'jasmine-flower', label: '자스민 꽃', tab: 'flower', imageUrl: 'https://media.maplestorywiki.net/yetidb/Etc_Jasmine_Flower.png' },
    { id: 'tea-tree-flower', label: '티트리 꽃', tab: 'flower', imageUrl: 'https://media.maplestorywiki.net/yetidb/Etc_Tea_Tree_Flower.png' },
    { id: 'chamomile-flower', label: '카모마일 꽃', tab: 'flower', imageUrl: 'https://media.maplestorywiki.net/yetidb/Etc_Chamomile_Flower.png' },
    { id: 'patchouli-flower', label: '페츌리 꽃', tab: 'flower', imageUrl: 'https://media.maplestorywiki.net/yetidb/Etc_Patchouli_Flower.png' },
    { id: 'hyssop-flower', label: '히솝 꽃', tab: 'flower', imageUrl: 'https://media.maplestorywiki.net/yetidb/Etc_Hyssop_Flower.png' },
  ],
  ore: [
    { id: 'opal', label: '오팔의 원석', tab: 'ore', imageUrl: 'https://media.maplestorywiki.net/yetidb/Etc_Opal_Ore.png' },
    { id: 'silver', label: '은의 원석', tab: 'ore', imageUrl: 'https://media.maplestorywiki.net/yetidb/Etc_Silver_Ore.png' },
    { id: 'amethyst', label: '자수정의 원석', tab: 'ore', imageUrl: 'https://media.maplestorywiki.net/yetidb/Etc_Amethyst_Ore.png' },
    { id: 'orichalcum', label: '오리할콘의 원석', tab: 'ore', imageUrl: 'https://media.maplestorywiki.net/yetidb/Etc_Orihalcon_Ore.png' },
    { id: 'sapphire', label: '사파이어의 원석', tab: 'ore', imageUrl: 'https://media.maplestorywiki.net/yetidb/Etc_Sapphire_Ore.png' },
    { id: 'steel', label: '강철의 원석', tab: 'ore', imageUrl: 'https://media.maplestorywiki.net/yetidb/Etc_Steel_Ore.png' },
    { id: 'adamantium', label: '아다만티움의 원석', tab: 'ore', imageUrl: 'https://media.maplestorywiki.net/yetidb/Etc_Adamantium_Ore.png' },
    { id: 'bronze', label: '청동의 원석', tab: 'ore', imageUrl: 'https://media.maplestorywiki.net/yetidb/Etc_Bronze_Ore.png' },
    { id: 'emerald', label: '에메랄드의 원석', tab: 'ore', imageUrl: 'https://media.maplestorywiki.net/yetidb/Etc_Emerald_Ore.png' },
    { id: 'mystic', label: '미스릴의 원석', tab: 'ore', imageUrl: 'https://media.maplestorywiki.net/yetidb/Etc_Mithril_Ore.png' },
    { id: 'power-crystal', label: '힘의 크리스탈 원석', tab: 'ore', imageUrl: 'https://media.maplestorywiki.net/yetidb/Etc_Power_Crystal_Ore.png' },
    { id: 'luk-crystal', label: '행운의 크리스탈 원석', tab: 'ore', imageUrl: 'https://media.maplestorywiki.net/yetidb/Etc_LUK_Crystal_Ore.png' },
    { id: 'dex-crystal', label: '민첩성의 크리스탈 원석', tab: 'ore', imageUrl: 'https://media.maplestorywiki.net/yetidb/Etc_DEX_Crystal_Ore.png' },
    { id: 'int-crystal', label: '지혜의 크리스탈 원석', tab: 'ore', imageUrl: 'https://media.maplestorywiki.net/yetidb/Etc_Wisdom_Crystal_Ore.png' },
    { id: 'heart-crystal', label: '어둠의 크리스탈 원석', tab: 'ore', imageUrl: 'https://media.maplestorywiki.net/yetidb/Etc_Dark_Crystal_Ore.png' },
    { id: 'topaz', label: '토파즈의 원석', tab: 'ore', imageUrl: 'https://media.maplestorywiki.net/yetidb/Etc_Topaz_Ore.png' },
    { id: 'gold', label: '금의 원석', tab: 'ore', imageUrl: 'https://media.maplestorywiki.net/yetidb/Etc_Gold_Ore.png' },
    { id: 'aquamarine', label: '아쿠아마린의 원석', tab: 'ore', imageUrl: 'https://media.maplestorywiki.net/yetidb/Etc_AquaMarine_Ore.png' },
    { id: 'diamond', label: '다이아몬드의 원석', tab: 'ore', imageUrl: 'https://media.maplestorywiki.net/yetidb/Etc_Diamond_Ore.png' },
    { id: 'garnet', label: '가넷의 원석', tab: 'ore', imageUrl: 'https://media.maplestorywiki.net/yetidb/Etc_Garnet_Ore.png' },
    { id: 'crystal-luck', label: '리튬의 원석', tab: 'ore', imageUrl: 'https://media.maplestorywiki.net/yetidb/Etc_Lidium_Ore.png' },
  ],
};

function createRow(item?: GatheringItem): GatheringRow {
  return {
    id: crypto.randomUUID(),
    label: item?.label ?? '',
    quantity: '',
    unitPrice: '',
    tab: item?.tab ?? 'seed',
  };
}

function parseNumber(value: string) {
  const parsed = Number(value.replace(/,/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function createEmptyRecordSummary(): RecordSummary {
  return {
    total: 0,
    count: 0,
    byTab: {
      seed: 0,
      flower: 0,
      ore: 0,
    },
  };
}

function getMonthBounds(monthKey: string) {
  const [yearPart, monthPart] = monthKey.split('-');
  const year = Number(yearPart);
  const monthIndex = Number(monthPart) - 1;
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  return { start, end };
}

function formatMonthLabel(monthKey: string) {
  const [yearPart, monthPart] = monthKey.split('-');
  const year = Number(yearPart);
  const month = Number(monthPart);
  return `${year}년 ${month}월`;
}

function getTabTone(tab: Exclude<GatheringTabKey, 'favorite'>): TabTone {
  if (tab === 'seed') {
    return {
      labelClass: 'text-emerald-700',
      badgeClass: 'bg-emerald-500/10 text-emerald-700',
      softClass: 'bg-emerald-500/6',
    };
  }

  if (tab === 'flower') {
    return {
      labelClass: 'text-fuchsia-700',
      badgeClass: 'bg-fuchsia-500/10 text-fuchsia-700',
      softClass: 'bg-fuchsia-500/6',
    };
  }

  return {
    labelClass: 'text-sky-700',
    badgeClass: 'bg-sky-500/10 text-sky-700',
    softClass: 'bg-sky-500/6',
  };
}

export default function GatheringPage() {
  const { data: session, status: sessionStatus } = useSession();
  const isLoggedIn = !!session?.user?.id;
  const activeCharacterId = useActiveCharacterId();
  const [activeTab, setActiveTab] = useState<GatheringTabKey>('favorite');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [rows, setRows] = useState<GatheringRow[]>([createRow()]);
  const [recentItems, setRecentItems] = useState<GatheringItem[]>([
    ITEMS.seed.find((item) => item.id === 'juniperberry-seed')!,
    ITEMS.flower.find((item) => item.id === 'juniperberry-flower')!,
    ITEMS.ore.find((item) => item.id === 'opal')!,
    ITEMS.ore.find((item) => item.id === 'power-crystal')!,
  ]);
  const [selectedMonth, setSelectedMonth] = useState(formatDate(new Date()).slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const monthBounds = useMemo(() => getMonthBounds(selectedMonth), [selectedMonth]);
  const {
    data: records = [],
    isLoading: recordsLoading,
    error: recordsQueryError,
  } = useGatheringRevenuesQuery({
    userId: session?.user?.id,
    isLoggedIn,
    characterId: activeCharacterId ?? '',
    start: formatDate(monthBounds.start),
    end: formatDate(monthBounds.end),
  });
  const {
    saveGatheringRevenue,
    deleteGatheringRevenue,
    isSaving: saving,
  } = useGatheringRevenueMutations({ isLoggedIn });
  const recordsError = !activeCharacterId && isLoggedIn
    ? '활성 캐릭터를 선택하면 저장된 기록을 볼 수 있어요.'
    : recordsQueryError?.message ?? '';

  const visibleItems = activeTab === 'favorite' ? recentItems : ITEMS[activeTab];

  const total = useMemo(
    () =>
      rows.reduce((sum, row) => {
        const quantity = parseNumber(row.quantity);
        const unitPrice = parseNumber(row.unitPrice);
        return sum + quantity * unitPrice;
      }, 0),
    [rows],
  );

  const saveableRows = useMemo(
    () =>
      rows
        .map((row) => ({
          itemName: row.label.trim(),
          itemTab: row.tab,
          quantity: parseNumber(row.quantity),
          unitPrice: parseNumber(row.unitPrice),
        }))
        .filter((row) => !!row.itemName && row.quantity > 0 && row.unitPrice > 0),
    [rows],
  );

  const recordSummary = useMemo(() => {
    return records.reduce<RecordSummary>((acc, record) => {
      acc.total += record.total_amount;
      acc.count += 1;
      acc.byTab[record.item_tab] += record.total_amount;
      return acc;
    }, createEmptyRecordSummary());
  }, [records]);

  const selectedMonthLabel = useMemo(() => formatMonthLabel(selectedMonth), [selectedMonth]);

  const addRow = (item?: GatheringItem) => {
    setRows((current) => [...current, createRow(item)]);
    if (!item) return;

    setRecentItems((current) => {
      const next = [item, ...current.filter((recentItem) => recentItem.id !== item.id)];
      return next.slice(0, 4);
    });
  };

  const patchRow = (rowId: string, patch: Partial<GatheringRow>) => {
    setRows((current) => current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  };

  const handleSave = async () => {
    if (!isLoggedIn || !activeCharacterId) {
      setSaveError('로그인하고 활성 캐릭터를 선택한 뒤 저장할 수 있어요.');
      return;
    }

    if (saveableRows.length === 0) {
      setSaveError('저장할 채집 기록이 없어요.');
      return;
    }

    setSaveError('');
    setSaveMessage('');

    try {
      const saved = await saveGatheringRevenue({
        date: selectedDate,
        characterId: activeCharacterId,
        entries: saveableRows,
      });
      setRows([createRow()]);
      setSaveMessage(`${saved.length}개 채집 기록을 저장했어요.`);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '채집 저장에 실패했어요.');
    }
  };

  const handleDeleteRecord = async (record: SavedGatheringRevenue) => {
    if (!isLoggedIn) {
      setSaveError('로그인한 뒤 삭제할 수 있어요.');
      return;
    }

    if (!window.confirm(`"${record.item_name}" 채집 기록을 삭제하시겠습니까?`)) return;

    setSaveError('');
    setSaveMessage('');

    try {
      await deleteGatheringRevenue(record.id);
      setSaveMessage('채집 기록을 삭제했어요.');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '채집 삭제에 실패했어요.');
    }
  };

  return (
    
    <main className="maple-fade-up flex flex-col gap-4 px-4 pt-6 pb-4 md:relative md:left-1/2 md:w-[760px] md:max-w-none md:-translate-x-1/2 md:px-0">
      <div className="w-full">
        <div className="mb-4 px-0">
          <h1 className="maple-title text-2xl font-bold text-t1">채집</h1>
          <p className="mt-1 text-xs text-t3">쥬니퍼베리 씨앗, 꽃, 원석 전리품을 한 줄씩 적어서 수익을 계산해요.</p>
        </div>

        <button
          type="button"
          onClick={() => setIsEditorOpen((current) => !current)}
          className="mt-4 flex w-full items-start justify-between gap-3 rounded-2xl border border-line bg-white/90 px-4 py-4 text-left shadow-[var(--shadow-sm)] transition-colors hover:border-amber-500/30 hover:bg-white"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-t1">채집 기록 추가</p>
            <p className="mt-1 text-[11px] leading-5 text-t3">
              버튼을 누르면 입력 폼이 펼쳐져요. 기록은 아래 카드와 함께 관리합니다.
            </p>
          </div>
          <div className="shrink-0 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-500/15">
            {isEditorOpen ? '접기' : '+ 추가'}
          </div>
        </button>

        {isEditorOpen ? (
          <Card className="mt-4">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <Input label="날짜" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
              <Button
                type="button"
                size="md"
                fullWidth
                disabled={saving || saveableRows.length === 0 || !isLoggedIn || !activeCharacterId}
                onClick={handleSave}
              >
                {sessionStatus === 'loading' ? '로그인 확인 중...' : saving ? '저장 중...' : '채집 저장'}
              </Button>
            </div>
            {sessionStatus !== 'loading' && (!isLoggedIn || !activeCharacterId) && (
              <p className="mt-2 text-xs text-red-500">
                {!isLoggedIn
                  ? '로그인 세션을 확인할 수 없어요. 로그아웃 후 다시 로그인해주세요.'
                  : '활성 캐릭터를 선택한 뒤 저장할 수 있어요.'}
              </p>
            )}
            {(saveMessage || saveError) && (
              <p className={`mt-2 text-xs ${saveError ? 'text-red-500' : 'text-emerald-600'}`}>
                {saveError || saveMessage}
              </p>
            )}

            <div className="mt-4 grid grid-cols-4 gap-1.5 rounded-2xl bg-surface p-1">
              {TABS.map((tab) => {
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`rounded-xl px-2 py-3 text-center transition-all ${
                      active ? 'bg-white text-t1 shadow-[0_8px_18px_rgba(0,0,0,0.06)]' : 'text-t3 hover:text-t2'
                    }`}
                  >
                    <p className="text-sm font-semibold">{tab.label}</p>
                    <p className="mt-0.5 text-[10px]">{tab.subtitle}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 grid grid-cols-5 gap-1 sm:grid-cols-6 lg:grid-cols-7">
              {visibleItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => addRow(item)}
                  title={item.label}
                  className="group flex w-full flex-col overflow-hidden rounded-lg border border-line bg-white/90 text-left shadow-[var(--shadow-sm)] transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-500/35 hover:bg-white"
                >
                  <div className="relative flex aspect-square items-center justify-center bg-[linear-gradient(135deg,rgba(250,244,232,0.96),rgba(255,255,255,0.94))] p-0.5">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.label}
                        fill
                        sizes="(max-width: 640px) 20vw, (max-width: 1024px) 16vw, 96px"
                        className="h-full w-full object-contain drop-shadow-[0_6px_12px_rgba(0,0,0,0.1)]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center rounded-2xl border border-dashed border-amber-500/15 bg-white/70">
                        <span className="text-lg font-bold tracking-tight text-t3">{item.label.slice(0, 1)}</span>
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-x-1 bottom-1 translate-y-1 rounded-md bg-black/55 px-1 py-0.5 text-center text-[8px] font-semibold leading-tight text-white opacity-0 blur-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
                      {item.label}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-5 border-t border-line pt-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-t1">선택된 아이템 개수 입력</p>
                  <p className="mt-1 text-[11px] text-t3">아래에서 아이템명, 수량, 단가를 한 줄로 정리합니다.</p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {rows.map((row) => {
                  const quantity = parseNumber(row.quantity);
                  const unitPrice = parseNumber(row.unitPrice);
                  const rowTotal = quantity * unitPrice;
                  return (
                    <div key={row.id} className="rounded-2xl border border-line bg-surface/35 p-2">
                      <div className="grid gap-2 grid-cols-1 xl:grid-cols-[minmax(0,1.7fr)_80px_92px_84px_auto] xl:items-center">
                        <div className="flex min-w-0 items-center gap-2 rounded-xl border border-line-str bg-field px-2.5 py-1.5 shadow-[var(--shadow-sm)]">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-white">
                            <span className="text-[9px] font-bold text-t3">
                              {row.tab === 'seed' ? '씨앗' : row.tab === 'flower' ? '꽃' : '원석'}
                            </span>
                          </div>
                          <input
                            value={row.label}
                            onChange={(e) => patchRow(row.id, { label: e.target.value })}
                            placeholder="예: 쥬니퍼베리 씨앗"
                            className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-t1 outline-none placeholder:text-t3/70"
                          />
                        </div>
                        <label className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-line-str bg-white px-2.5 py-2 shadow-[var(--shadow-sm)]">
                          <span className="text-[9px] font-semibold text-t3">수량</span>
                          <input
                            value={row.quantity}
                            onChange={(e) => patchRow(row.id, { quantity: e.target.value.replace(/[^0-9]/g, '') })}
                            placeholder="0"
                            inputMode="numeric"
                            className="w-9 min-w-0 bg-transparent text-right text-[13px] font-semibold text-t1 outline-none placeholder:text-t3/60"
                          />
                        </label>
                        <label className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-line-str bg-white px-2.5 py-2 shadow-[var(--shadow-sm)]">
                          <span className="text-[9px] font-semibold text-t3">단가</span>
                          <input
                            value={row.unitPrice}
                            onChange={(e) => patchRow(row.id, { unitPrice: e.target.value.replace(/[^0-9]/g, '') })}
                            placeholder="0"
                            inputMode="numeric"
                            className="w-11 min-w-0 bg-transparent text-right text-[13px] font-semibold text-t1 outline-none placeholder:text-t3/60"
                          />
                        </label>
                        <div className="rounded-xl bg-white px-2.5 py-2 text-right shadow-[var(--shadow-sm)]">
                          <p className="text-[9px] text-t3">합계</p>
                          <p className="mt-1 text-[12px] font-bold text-t1">{formatMeso(rowTotal)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setRows((current) => current.filter((currentRow) => currentRow.id !== row.id))}
                          className="h-9 w-full rounded-xl border border-red-500/20 bg-red-500/8 px-2 text-[10px] font-semibold text-red-600 transition-colors hover:bg-red-500/15 xl:w-auto"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 rounded-2xl bg-[#f7efe1] px-4 py-3 text-right">
                <p className="text-[11px] text-t3">총 수익</p>
                <p className="mt-1 text-lg font-bold text-amber-600">{formatMeso(total)}</p>
              </div>
            </div>
          </Card>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-line bg-white/65 px-4 py-8 text-sm text-t3">
            채집 기록 입력 폼이 접혀 있어요. 버튼을 누르면 기록 추가 화면이 펼쳐집니다.
          </div>
        )}

        <Card className="mt-4 border-amber-500/20 bg-[linear-gradient(135deg,rgba(255,250,241,0.98),rgba(255,255,255,0.95)_60%,rgba(250,244,232,0.98))]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-t1">채집 기록 · {selectedMonthLabel}</p>
              <p className="mt-1 text-[11px] leading-5 text-t3">이번 달 기록만 카드로 보여주고, 총 수익도 월별로 집계해요.</p>
            </div>
            <div className="rounded-2xl bg-[#f7efe1] px-3 py-2 text-right">
              <p className="text-[10px] text-t3">이번달 수익</p>
              <p className="mt-1 text-base font-bold text-amber-600">{formatMeso(recordSummary.total)}</p>
            </div>
          </div>

          <Card className="p-4 mt-4">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  const next = new Date(`${selectedMonth}-01T00:00:00`);
                  next.setMonth(next.getMonth() - 1);
                  setSelectedMonth(formatDate(next).slice(0, 7));
                }}
                className="cursor-pointer rounded-full px-2 py-1 text-lg text-t2 transition-colors hover:bg-surface hover:text-t1"
                aria-label="이전 달"
              >
                ‹
              </button>
              <div className="text-center">
                <p className="text-sm font-semibold text-t1">{selectedMonthLabel}</p>
                <p className="mt-0.5 text-xs text-t3">{recordSummary.count}일치 채집 기록</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = new Date(`${selectedMonth}-01T00:00:00`);
                  next.setMonth(next.getMonth() + 1);
                  setSelectedMonth(formatDate(next).slice(0, 7));
                }}
                className="cursor-pointer rounded-full px-2 py-1 text-lg text-t2 transition-colors hover:bg-surface hover:text-t1"
                aria-label="다음 달"
              >
                ›
              </button>
            </div>
          </Card>

          <div className="mt-4 flex flex-wrap gap-2">
            <div className="rounded-full bg-white/75 px-3 py-1.5 text-xs font-semibold text-t3">
              씨앗 {formatMeso(recordSummary.byTab.seed)}
            </div>
            <div className="rounded-full bg-white/75 px-3 py-1.5 text-xs font-semibold text-t3">
              꽃 {formatMeso(recordSummary.byTab.flower)}
            </div>
            <div className="rounded-full bg-white/75 px-3 py-1.5 text-xs font-semibold text-t3">
              원석 {formatMeso(recordSummary.byTab.ore)}
            </div>
          </div>

          <div className="mt-4">
            {!isLoggedIn ? (
              <div className="rounded-2xl border border-dashed border-line bg-white/70 px-4 py-8 text-center text-sm text-t3">
                로그인하면 채집 기록을 불러올 수 있어요.
              </div>
            ) : recordsLoading ? (
              <div className="rounded-2xl border border-line bg-white/70 px-4 py-8 text-center text-sm text-t3">
                채집 기록을 불러오는 중이에요...
              </div>
            ) : recordsError ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/8 px-4 py-4 text-sm text-red-600">
                {recordsError}
              </div>
            ) : records.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line bg-white/70 px-4 py-8 text-center text-sm text-t3">
                이번 달에 저장된 채집 기록이 없어요.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {records.map((record) => {
                  const tone = getTabTone(record.item_tab);
                  return (
                    <div
                      key={record.id}
                      className="relative overflow-hidden rounded-2xl border border-line bg-white/90 shadow-[var(--shadow-sm)]"
                    >
                      <div className={`h-1 w-full ${tone.softClass}`} />
                      <div className="flex items-start justify-between gap-3 p-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[11px] text-t3">{formatDateKorean(record.date)}</p>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone.badgeClass}`}>
                              {tabLabel(record.item_tab)}
                            </span>
                          </div>
                          <p className={`mt-1 line-clamp-2 text-sm font-semibold ${tone.labelClass}`}>{record.item_name}</p>
                          <p className="mt-1 text-[11px] text-t3">
                            {formatNumber(record.quantity)}개 · {formatMeso(record.unit_price)} / 개
                          </p>
                        </div>
                        <div className="relative shrink-0 self-start pt-2 pb-5 text-right">
                          <p className="text-[10px] text-t3">합계</p>
                          <p className="mt-1 text-base font-bold text-amber-600">{formatMeso(record.total_amount)}</p>
                          <button
                            type="button"
                            onClick={() => void handleDeleteRecord(record)}
                            disabled={saving}
                            aria-label={`${record.item_name} 삭제`}
                            title="삭제"
                            className="absolute right-0 bottom-0 inline-flex h-4 w-4 items-center justify-center rounded-full border border-red-500/10 bg-white/70 text-red-400 opacity-45 backdrop-blur-sm transition-all hover:opacity-100 hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-20 disabled:hover:opacity-20"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>
    </main>
  );
}

function tabLabel(tab: Exclude<GatheringTabKey, 'favorite'>) {
  return tab === 'seed' ? '씨앗' : tab === 'flower' ? '꽃' : '원석';
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-3 w-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4.8A1.8 1.8 0 0 1 9.8 3h4.4A1.8 1.8 0 0 1 16 4.8V6" />
      <path d="M6 6l1 14h10l1-14" />
      <path d="M10 10v6" />
      <path d="M14 10v6" />
    </svg>
  );
}
