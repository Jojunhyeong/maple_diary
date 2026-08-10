'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card } from '@/shared/ui/Card';
import { Input } from '@/shared/ui/Input';
import {
  BOSS_CATALOG,
  type BossCategoryKey,
  type BossDifficultyKey,
  getBossCategory,
} from '@/shared/data/boss-catalog';
import { BOSS_DROP_ITEM_OPTIONS, getBossDropItemOption } from '@/shared/data/boss-drop-items';
import { useActiveCharacterId } from '@/shared/lib/hooks/useActiveCharacterId';
import {
  getBossThursday,
  getBossMonthKey,
  getBossWeekKey,
  filterBossChecklistStateByCycle,
  removeBossChecklistStatesByCycles,
  mergeBossChecklistStates,
  type BossLootItem,
  type ChecklistState,
  type BossSelection,
} from '@/shared/lib/boss-checklist';
import { formatMeso, formatDate } from '@/shared/lib/utils/formatters';

const LOOT_PRICE_UNIT = 10_000_000;

export default function BossPage() {
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user?.id;
  const activeCharacterId = useActiveCharacterId();
  const weekKey = getBossWeekKey();
  const monthKey = getBossMonthKey();
  const [activeCategory, setActiveCategory] = useState<BossCategoryKey>('grandis');
  const [state, setState] = useState<ChecklistState>({});
  const [isHydrated, setIsHydrated] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [isWeeklyLocked, setIsWeeklyLocked] = useState(false);
  const [isMonthlyLocked, setIsMonthlyLocked] = useState(false);
  const [isEditingSavedCycles, setIsEditingSavedCycles] = useState(false);
  const [expandedBossId, setExpandedBossId] = useState<string | null>(null);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    let cancelled = false;

    const run = async () => {
      setIsReady(false);
      setSaveMessage('');
      setIsWeeklyLocked(false);
      setIsMonthlyLocked(false);
      setIsEditingSavedCycles(false);
      setState({});

      if (!activeCharacterId) {
        if (!cancelled) {
          setIsReady(true);
        }
        return;
      }

      if (!isLoggedIn) {
        if (!cancelled) {
          setSaveMessage('로그인 후 보스 수익을 기록할 수 있어요');
          setIsReady(true);
        }
        return;
      }

      try {
        const [weeklyRes, monthlyRes] = await Promise.all([
          fetch(`/api/boss-revenues?${new URLSearchParams({ weekKey, cycleType: 'weekly', characterId: activeCharacterId }).toString()}`),
          fetch(`/api/boss-revenues?${new URLSearchParams({ weekKey: monthKey, cycleType: 'monthly', characterId: activeCharacterId }).toString()}`),
        ]);
        if (!weeklyRes.ok || !monthlyRes.ok) throw new Error('boss revenue load failed');

        const weeklyRows = (await weeklyRes.json()) as Array<{ state?: ChecklistState }>;
        const monthlyRows = (await monthlyRes.json()) as Array<{ state?: ChecklistState }>;

        if (cancelled) return;

        const weeklyRow = weeklyRows[0];
        const monthlyRow = monthlyRows[0];

        if (weeklyRow?.state) {
          setState((prev) => mergeBossChecklistStates(prev, weeklyRow.state));
          setIsWeeklyLocked(true);
        } else {
          setIsWeeklyLocked(false);
        }

        if (monthlyRow?.state) {
          setState((prev) => mergeBossChecklistStates(prev, monthlyRow.state));
          setIsMonthlyLocked(true);
        } else {
          setIsMonthlyLocked(false);
        }

        if (weeklyRow?.state && monthlyRow?.state) {
          setSaveMessage('이번 주와 이번 달은 이미 저장된 상태예요');
        } else if (weeklyRow?.state) {
          setSaveMessage('이번 주는 이미 저장된 상태예요');
        } else if (monthlyRow?.state) {
          setSaveMessage('이번 달은 이미 저장된 상태예요');
        }

        if (!cancelled) {
          setIsReady(true);
        }
      } catch {
        if (!cancelled) {
          setState({});
          setSaveMessage('보스 수익을 불러오지 못했어요');
          setIsReady(true);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [isHydrated, isLoggedIn, activeCharacterId, weekKey, monthKey]);

  const getBossLockState = (bossId: string) => {
    if (!isLoggedIn) return true;
    const boss = BOSS_CATALOG.flatMap((group) => group.bosses).find((entry) => entry.id === bossId);
    return boss?.resetCycle === 'monthly' ? isMonthlyLocked : isWeeklyLocked;
  };

  const activeGroup = useMemo(() => getBossCategory(activeCategory), [activeCategory]);
  const dropItemOptions = BOSS_DROP_ITEM_OPTIONS.filter((option) => option.id !== 'misc_loot');
  const lootItems = useMemo(() => state.__lootItems ?? [], [state.__lootItems]);
  const lootRevenue = useMemo(
    () => lootItems.reduce((sum, item) => (item.checked ? sum + Math.max(0, item.sellPrice || 0) : sum), 0),
    [lootItems],
  );
  const lootCount = useMemo(() => lootItems.filter((item) => item.checked).length, [lootItems]);

  const summary = useMemo(() => {
    const totals = {
      totalRevenue: 0,
      selectedBosses: 0,
      selectedClears: 0,
      lootRevenue,
      lootCount,
      byCategory: {
        general: 0,
        subboss: 0,
        grandis: 0,
      } satisfies Record<BossCategoryKey, number>,
    };

    for (const group of BOSS_CATALOG) {
      for (const boss of group.bosses) {
        const selection = state[boss.id];
        const activeDifficulty =
          selection?.activeDifficulty && selection.difficulties[selection.activeDifficulty]?.checked
            ? selection.activeDifficulty
            : undefined;
        if (!activeDifficulty) continue;
        totals.selectedBosses += 1;
        totals.selectedClears += 1;
        const price = boss.difficulties[activeDifficulty] ?? 0;
        const partySize = Math.max(1, selection.difficulties[activeDifficulty]?.partySize ?? 1);
        const revenue = Math.floor(price / partySize);
        totals.totalRevenue += revenue;
        totals.byCategory[group.key] += revenue;
      }
    }

    totals.totalRevenue += lootRevenue;

    return totals;
  }, [state, lootRevenue, lootCount]);

  const selectedEntries = useMemo(() => {
    const entries: Array<{
      bossName: string;
      category: BossCategoryKey;
      difficulty: BossDifficultyKey;
      partySize: number;
      revenue: number;
    }> = [];

    for (const group of BOSS_CATALOG) {
      for (const boss of group.bosses) {
        const selection = state[boss.id];
        const activeDifficulty =
          selection?.activeDifficulty && selection.difficulties[selection.activeDifficulty]?.checked
            ? selection.activeDifficulty
            : undefined;
        if (!activeDifficulty) continue;
        const entryState = selection.difficulties[activeDifficulty];
        const price = boss.difficulties[activeDifficulty];
        if (!price) continue;
        const partySize = Math.max(1, entryState?.partySize ?? 1);
        entries.push({
          bossName: boss.name,
          category: group.key,
          difficulty: activeDifficulty,
          partySize,
          revenue: Math.floor(price / partySize),
        });
      }
    }

    return entries.sort((a, b) => b.revenue - a.revenue);
  }, [state]);

  const canEditLoot = isLoggedIn && (!isWeeklyLocked || isEditingSavedCycles);

  const updateLootItems = (updater: (items: BossLootItem[]) => BossLootItem[]) => {
    if (!isHydrated || !canEditLoot) return;
    setState((prev) => {
      const nextItems = updater(prev.__lootItems ?? []);
      return {
        ...prev,
        __lootItems: nextItems,
      } as ChecklistState;
    });
  };

  const addLootItem = (itemId = '', name = '', checked = true) => {
    updateLootItems((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        itemId,
        name,
        sellPrice: 0,
        checked,
      },
    ]);
  };

  const addMiscLootItem = () => {
    const miscLoot = getBossDropItemOption('misc_loot');
    addLootItem(miscLoot?.id ?? 'misc_loot', miscLoot?.label ?? '기타 잡템', true);
  };

  const patchLootItem = (itemId: string, patch: Partial<BossLootItem>) => {
    updateLootItems((items) =>
      items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    );
  };

  const removeLootItem = (itemId: string) => {
    updateLootItems((items) => items.filter((item) => item.id !== itemId));
  };

  const handleToggle = (bossId: string, difficulty: BossDifficultyKey, checked: boolean) => {
    if (!isHydrated || !isLoggedIn) return;
    if (getBossLockState(bossId)) return;
    setState((prev) => {
      const boss = BOSS_CATALOG.flatMap((group) => group.bosses).find((entry) => entry.id === bossId);
      const current = prev[bossId] ?? { activeDifficulty: undefined, difficulties: {} };
      const currentEntry = current.difficulties[difficulty] ?? { checked: false, partySize: 1 };
      const maxPartySize = boss?.difficultyMaxPartySize?.[difficulty] ?? boss?.maxPartySize ?? 6;
      if (!checked) {
        if (!current.activeDifficulty || current.activeDifficulty !== difficulty) return prev;
        return {
          ...prev,
          [bossId]: {
            ...current,
            activeDifficulty: undefined,
            difficulties: {
              ...current.difficulties,
              [difficulty]: {
                checked: false,
                partySize: Math.min(Math.max(1, currentEntry.partySize), maxPartySize),
              },
            },
          },
        };
      }

      const nextDifficulties = Object.fromEntries(
        [...Object.keys(boss?.difficulties ?? {})].map((diff) => {
          const key = diff as BossDifficultyKey;
          const entry = current.difficulties[key] ?? { checked: false, partySize: 1 };
          const limit = boss?.difficultyMaxPartySize?.[key] ?? boss?.maxPartySize ?? 6;
          return [
            key,
            {
              checked: key === difficulty,
              partySize: Math.min(Math.max(1, entry.partySize), limit),
            },
          ];
        }),
      ) as BossSelection['difficulties'];

      nextDifficulties[difficulty] = {
        checked: true,
        partySize: Math.min(Math.max(1, currentEntry.partySize), maxPartySize),
      };

      return {
        ...prev,
        [bossId]: {
          activeDifficulty: difficulty,
          difficulties: nextDifficulties,
        },
      };
    });
  };

  const handleCountChange = (bossId: string, difficulty: BossDifficultyKey, count: number) => {
    if (!isHydrated || !isLoggedIn) return;
    if (getBossLockState(bossId)) return;
    setState((prev) => {
      const boss = BOSS_CATALOG.flatMap((group) => group.bosses).find((entry) => entry.id === bossId);
      const current = prev[bossId] ?? { difficulties: {} };
      if (current.activeDifficulty !== difficulty) return prev;
      return {
        ...prev,
        [bossId]: {
          ...current,
          difficulties: {
            ...current.difficulties,
            [difficulty]: {
              ...(current.difficulties[difficulty] ?? { checked: true, partySize: 1 }),
              checked: true,
              partySize: Math.min(Math.max(1, count), boss?.difficultyMaxPartySize?.[difficulty] ?? boss?.maxPartySize ?? 6),
            },
          },
        },
      };
    });
  };

  const handleClearCategory = (category: BossCategoryKey) => {
    if (!isHydrated || !isLoggedIn) return;
    setState((prev) => {
      const next = { ...prev };
      const group = getBossCategory(category);
      for (const boss of group.bosses) {
        if (getBossLockState(boss.id)) continue;
        delete next[boss.id];
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!isHydrated) return;
    if (!activeCharacterId) {
      setSaveMessage('캐릭터를 먼저 선택해주세요');
      return;
    }
    if (!isLoggedIn) {
      setSaveMessage('로그인 후 저장할 수 있어요');
      return;
    }
    if (isWeeklyLocked && isMonthlyLocked) {
      setSaveMessage('이번 주와 이번 달은 이미 저장했어요');
      return;
    }

    const stateToSave = isWeeklyLocked && !isMonthlyLocked
      ? filterBossChecklistStateByCycle(state, 'monthly')
      : !isWeeklyLocked && isMonthlyLocked
        ? filterBossChecklistStateByCycle(state, 'weekly')
        : state;

    setIsSaving(true);
    setSaveMessage('');
    try {
      const res = await fetch('/api/boss-revenues', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ weekKey, monthKey, characterId: activeCharacterId, state: stateToSave }),
      });

      if (res.status === 409) {
        const message = isWeeklyLocked || isMonthlyLocked ? '저장할 수 있는 기간이 없어요' : '이미 저장된 상태예요';
        setSaveMessage(message);
        return;
      }

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: string; dbError?: { code?: string; message?: string; hint?: string; details?: string } }
          | null;
        const detail = payload?.dbError
          ? [payload.dbError.message, payload.dbError.hint, payload.dbError.details].filter(Boolean).join(' | ')
          : payload?.error;
        throw new Error(detail || 'boss revenue save failed');
      }

      const data = (await res.json()) as { savedCycles?: Array<'weekly' | 'monthly'> };
      const savedCycles = new Set(data.savedCycles ?? []);
      if (savedCycles.has('weekly')) setIsWeeklyLocked(true);
      if (savedCycles.has('monthly')) setIsMonthlyLocked(true);
      setIsEditingSavedCycles(false);

      if (savedCycles.has('weekly') && savedCycles.has('monthly')) {
        setSaveMessage('이번 주와 이번 달 저장 완료');
      } else if (savedCycles.has('weekly')) {
        setSaveMessage('이번 주 저장 완료');
      } else if (savedCycles.has('monthly')) {
        setSaveMessage('이번 달 저장 완료');
      } else {
        setSaveMessage('저장된 내용이 없어요');
      }
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : '저장에 실패했어요');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditAll = () => {
    if (!isLoggedIn) {
      setSaveMessage('로그인 후 수정할 수 있어요');
      return;
    }
    if (!isWeeklyLocked && !isMonthlyLocked) {
      setSaveMessage('이미 수정 가능한 상태예요');
      return;
    }

    setIsEditingSavedCycles(true);
    setIsWeeklyLocked(false);
    setIsMonthlyLocked(false);
    setSaveMessage('저장된 보스를 수정한 뒤 다시 저장해주세요');
  };

  const handleDeleteAll = async () => {
    if (!isLoggedIn) {
      setSaveMessage('로그인 후 삭제할 수 있어요');
      return;
    }
    if (!activeCharacterId) {
      setSaveMessage('캐릭터를 먼저 선택해주세요');
      return;
    }

    const shouldDelete = window.confirm('현재 캐릭터의 보스 저장본을 삭제할까요?');
    if (!shouldDelete) return;

    try {
      const res = await fetch(
        `/api/boss-revenues?${new URLSearchParams({
          weekKey,
          monthKey,
          characterId: activeCharacterId,
        }).toString()}`,
        { method: 'DELETE' },
      );

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: string; dbError?: { code?: string; message?: string; hint?: string; details?: string } }
          | null;
        const detail = payload?.dbError
          ? [payload.dbError.message, payload.dbError.hint, payload.dbError.details].filter(Boolean).join(' | ')
          : payload?.error;
        throw new Error(detail || 'boss revenue delete failed');
      }

      setState((prev) => removeBossChecklistStatesByCycles(prev, ['weekly', 'monthly']));
      setIsWeeklyLocked(false);
      setIsMonthlyLocked(false);
      setIsEditingSavedCycles(false);
      setSaveMessage('보스 저장본을 삭제했어요');
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : '삭제에 실패했어요');
    }
  };

  const weekLabel = (() => {
    const start = getBossThursday(new Date(weekKey));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return `${formatDate(start)} ~ ${formatDate(end)}`;
  })();

  return (
    <main className="maple-fade-up flex flex-col gap-5 px-4 pt-6 pb-4 md:relative md:left-1/2 md:w-[760px] md:max-w-none md:-translate-x-1/2 md:px-0">
      {!isReady ? (
        <Card className="py-10 text-center">
          <p className="text-sm text-t3">보스 수익 불러오는 중...</p>
        </Card>
      ) : (
        <>
        <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="maple-title text-2xl font-bold text-t1">보스 수익</h1>
          <p className="mt-1 text-xs text-t3">체크한 보스와 보스별 드랍템을 기준으로 주간(목~수)과 월간 검마 수익을 합산해요</p>
          <p className="mt-1 text-[11px] text-t3">로그인 후 서버에 주간/월간 수익을 저장할 수 있어요</p>
          <p className="mt-2 text-[11px] text-t3">주간 기준 · {weekLabel}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={!isLoggedIn || isSaving || (!isEditingSavedCycles && (isWeeklyLocked || isMonthlyLocked))}
            className="rounded-full border border-amber-500/30 bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-500/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? '저장 중...' : '저장'}
          </button>
          <button
            type="button"
            onClick={isEditingSavedCycles ? () => void handleDeleteAll() : handleEditAll}
            disabled={!isLoggedIn}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              isEditingSavedCycles
                ? 'border border-red-500/25 bg-red-500/10 text-red-600 hover:bg-red-500/15'
                : 'border border-amber-500/25 bg-amber-500/10 text-amber-600 hover:bg-amber-500/15'
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {isEditingSavedCycles ? '삭제' : '수정'}
          </button>
        </div>
          {saveMessage && <p className="text-[11px] text-t3">{saveMessage}</p>}
        </div>
      </div>

      <Card className="border-amber-500/20 bg-[linear-gradient(130deg,rgba(245,158,11,0.18),rgba(245,158,11,0.05)_55%,transparent)]">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <MetricCard label="보스 예상 수익" value={formatMeso(summary.totalRevenue)} highlight />
          <MetricCard label="체크한 보스" value={`${summary.selectedBosses}개`} />
          <MetricCard label="드랍템 체크" value={`${summary.lootCount}개`} />
          <MetricCard label="현재 탭" value={activeGroup.label} />
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-2">
        {BOSS_CATALOG.map((group) => {
          const active = activeCategory === group.key;
          return (
            <button
              key={group.key}
              type="button"
              onClick={() => {
                setActiveCategory(group.key);
                setExpandedBossId(null);
              }}
              className={`rounded-2xl border px-3 py-3 text-left transition-all ${
                active
                  ? 'border-amber-500 bg-amber-500/10 shadow-[0_10px_18px_rgba(245,158,11,0.12)]'
                  : 'border-line bg-card hover:bg-surface/70'
              }`}
            >
              <p className={`text-sm font-semibold ${active ? 'text-amber-600' : 'text-t1'}`}>{group.label}</p>
              <p className={`mt-1 text-[11px] ${active ? 'text-amber-600/80' : 'text-t3'}`}>{group.description}</p>
            </button>
          );
        })}
      </div>

      <Card className="overflow-hidden border-line bg-card/95">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-t1">{activeGroup.label}</p>
            <p className="text-[11px] text-t3">{activeGroup.description}</p>
          </div>
          <button
            type="button"
            onClick={() => handleClearCategory(activeGroup.key)}
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-t2 transition-colors hover:bg-card"
          >
            현재 탭 초기화
          </button>
        </div>

        <div className="flex flex-col gap-3 px-3 py-3">
          {activeGroup.bosses.map((boss) => {
            const selection = state[boss.id] ?? { difficulties: {} };
            const activeDifficulty =
              selection.activeDifficulty && selection.difficulties[selection.activeDifficulty]?.checked
                ? selection.activeDifficulty
                : null;
            const activePartySize = activeDifficulty ? Math.max(1, selection.difficulties[activeDifficulty]?.partySize ?? 1) : 1;
            const checkedRevenue =
              activeDifficulty && boss.difficulties[activeDifficulty]
                ? Math.floor(boss.difficulties[activeDifficulty] / activePartySize)
                : 0;
            const availableDifficulties = activeGroup.columns.filter(
              (difficulty) => boss.difficulties[difficulty] !== undefined,
            );

            return (
              <div
                key={boss.id}
                className={`rounded-2xl border p-3 transition-all sm:p-3.5 ${
                  checkedRevenue > 0
                    ? 'border-amber-500/40 bg-amber-500/5 shadow-[0_10px_18px_rgba(245,158,11,0.08)]'
                    : 'border-line bg-surface/35'
                }`}
              >
                <div className="flex w-full items-center gap-2 sm:hidden">
                  <button
                    type="button"
                    aria-expanded={expandedBossId === boss.id}
                    aria-controls={`boss-difficulties-${boss.id}`}
                    onClick={() => setExpandedBossId((current) => (current === boss.id ? null : boss.id))}
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card text-[10px] font-bold text-t2">
                      {boss.name.slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-t1">{boss.name}</p>
                        {boss.resetCycle === 'monthly' && (
                          <span className="rounded-full bg-green-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-green-600">
                            월간
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-t3">{availableDifficulties.length}개 난이도</p>
                    </div>
                  </button>

                  <select
                    value={activeDifficulty ?? ''}
                    onChange={(event) => {
                      const nextDifficulty = event.target.value as BossDifficultyKey | '';
                      if (!nextDifficulty) {
                        if (activeDifficulty) handleToggle(boss.id, activeDifficulty, false);
                        return;
                      }
                      handleToggle(boss.id, nextDifficulty, true);
                    }}
                    disabled={getBossLockState(boss.id)}
                    aria-label={`${boss.name} 난이도 선택`}
                    className={`w-[72px] shrink-0 appearance-none bg-transparent text-right text-sm font-bold focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                      activeDifficulty ? 'text-amber-600' : 'text-t3'
                    }`}
                  >
                    <option value="">선택</option>
                    {availableDifficulties.map((difficulty) => (
                      <option key={difficulty} value={difficulty}>
                        {difficulty.toUpperCase()}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    aria-label={`${boss.name} 가격 상세 ${expandedBossId === boss.id ? '접기' : '펼치기'}`}
                    aria-expanded={expandedBossId === boss.id}
                    aria-controls={`boss-difficulties-${boss.id}`}
                    onClick={() => setExpandedBossId((current) => (current === boss.id ? null : boss.id))}
                    className="flex h-9 w-7 shrink-0 items-center justify-end text-t3"
                  >
                    <svg
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                      className={`h-4 w-4 text-t3 transition-transform ${
                        expandedBossId === boss.id ? 'rotate-180' : ''
                      }`}
                    >
                      <path
                        d="m5 7.5 5 5 5-5"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                      />
                    </svg>
                  </button>
                </div>

                <div className="hidden items-start justify-between gap-3 sm:flex">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card text-[10px] font-bold text-t2">
                        {boss.name.slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-t1">{boss.name}</p>
                          {boss.resetCycle === 'monthly' && (
                            <span className="rounded-full bg-green-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-green-600">
                              월간
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-t3">{activeGroup.label}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <p className="text-[11px] text-t3">난이도별 파티원 수</p>
                    <div className="flex items-center gap-2">
                      <p className="text-[11px] text-t2">{activeDifficulty ? `현재 ${activeDifficulty.toUpperCase()}` : '파티원 수:'}</p>
                      <select
                        value={activeDifficulty ? selection.difficulties[activeDifficulty]?.partySize ?? 1 : 1}
                        onClick={(event) => event.stopPropagation()}
                        onPointerDown={(event) => event.stopPropagation()}
                        onChange={(e) => {
                          if (!activeDifficulty) return;
                          handleCountChange(boss.id, activeDifficulty, Number(e.target.value));
                        }}
                        disabled={!activeDifficulty}
                        className="h-9 rounded-xl border border-line bg-card px-2 text-sm font-semibold text-t1 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                      >
                        {Array.from(
                          {
                            length:
                              activeDifficulty && selection.difficulties[activeDifficulty]
                                ? boss.difficultyMaxPartySize?.[activeDifficulty] ?? boss.maxPartySize ?? 6
                                : boss.maxPartySize ?? 6,
                          },
                          (_, idx) => idx + 1,
                        ).map((count) => (
                          <option key={count} value={count}>
                            {count}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div
                  id={`boss-difficulties-${boss.id}`}
                  className={`${expandedBossId === boss.id ? 'block' : 'hidden'} sm:block`}
                >
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-card px-3 py-2 sm:hidden">
                    <div>
                      <p className="text-xs font-semibold text-t1">파티원 수</p>
                      <p className="text-[10px] text-t3">
                        {activeDifficulty ? `${activeDifficulty.toUpperCase()} 난이도 기준` : '난이도를 먼저 선택해 주세요'}
                      </p>
                    </div>
                    <select
                      value={activeDifficulty ? selection.difficulties[activeDifficulty]?.partySize ?? 1 : 1}
                      onChange={(event) => {
                        if (!activeDifficulty) return;
                        handleCountChange(boss.id, activeDifficulty, Number(event.target.value));
                      }}
                      disabled={!activeDifficulty}
                      aria-label={`${boss.name} 파티원 수`}
                      className="h-9 rounded-xl border border-line bg-surface px-3 text-sm font-semibold text-t1 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                    >
                      {Array.from(
                        {
                          length:
                            activeDifficulty && selection.difficulties[activeDifficulty]
                              ? boss.difficultyMaxPartySize?.[activeDifficulty] ?? boss.maxPartySize ?? 6
                              : boss.maxPartySize ?? 6,
                        },
                        (_, idx) => idx + 1,
                      ).map((count) => (
                        <option key={count} value={count}>
                          {count}명
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-2 grid grid-cols-1 gap-2 sm:mt-3 sm:grid-cols-2 lg:grid-cols-4">
                    {availableDifficulties.map((difficulty) => {
                      const price = boss.difficulties[difficulty];
                      if (price === undefined) return null;
                      const entryState = selection.difficulties[difficulty] ?? { checked: false, partySize: 1 };
                      const selected = activeDifficulty === difficulty && !!entryState.checked;
                      const personalShare = selected ? Math.floor(price / Math.max(1, entryState.partySize ?? 1)) : price;
                      return (
                        <div
                          key={difficulty}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleToggle(boss.id, difficulty, !selected)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              handleToggle(boss.id, difficulty, !selected);
                            }
                          }}
                          className={`flex cursor-pointer flex-col gap-2 rounded-xl border px-3 py-2.5 text-left transition-all ${
                            selected
                              ? 'border-amber-500 bg-amber-500/10 shadow-[0_8px_16px_rgba(245,158,11,0.12)] -translate-y-0.5 scale-[1.01]'
                              : 'border-line bg-card'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className="inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold tracking-[0.06em] text-white"
                              style={{ background: difficultyColor(difficulty) }}
                            >
                              {difficulty.toUpperCase()}
                            </span>
                            {selected ? (
                              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                                선택됨
                              </span>
                            ) : (
                              <span className="text-[11px] text-t3"></span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-t1">{formatMeso(personalShare)}</p>
                            <p className="mt-0.5 text-[11px] text-t3">
                              {selected ? `${formatMeso(price)} ÷ ${Math.max(1, entryState.partySize ?? 1)}` : formatMeso(price)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-line/70 pt-3">
                    <p className="text-[11px] text-t3">{availableDifficulties.length}개 난이도</p>
                    <p className="text-sm font-bold text-t1">
                      {checkedRevenue > 0 ? formatMeso(checkedRevenue) : '-'}
                    </p>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-t1">보스 드랍템</p>
            <p className="text-[11px] text-t3">드랍템을 추가하고 품목은 드랍박스에서 선택해요. 기타 잡템도 묶어서 기록할 수 있어요.</p>
          </div>
          <div className="flex flex-col items-end gap-1 text-right">
            <p className="text-xs text-t3">{lootCount}개 체크</p>
            <p className="text-sm font-bold text-t1">{formatMeso(lootRevenue)}</p>
          </div>
        </div>

        {lootItems.length === 0 ? (
          <div className="rounded-xl bg-surface/50 py-8 text-center">
            <p className="text-sm text-t3">아직 등록한 드랍템이 없어요</p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              
              <button
                type="button"
                onClick={() => addLootItem()}
                disabled={!canEditLoot}
                className="rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-600 transition-colors hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                + 품목 추가
              </button>
              <button
                type="button"
                onClick={addMiscLootItem}
                disabled={!canEditLoot}
                className="rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-600 transition-colors hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                + 기타 잡템
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {lootItems.map((item) => (
              <div key={item.id} className="rounded-xl border border-line bg-surface/35 p-3">
                <div className="hidden min-w-0 grid-cols-[auto_minmax(0,1fr)_240px_auto] items-end gap-3 px-14 text-[11px] text-t3 sm:grid">
                  <div />
                  <span>드랍템</span>
                  <span>판매가</span>
                  <div />
                </div>
                <div className="mt-0 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[auto_minmax(0,1fr)_240px_auto] sm:items-center">
                  <div className="shrink-0">
                    <LootThumb itemId={item.itemId} label={item.name} />
                  </div>
                  {item.itemId === 'misc_loot' ? (
                    <div className="flex h-11 min-w-0 items-center rounded-xl border border-line bg-card px-3 text-sm font-medium text-t1">
                      기타 아이템
                    </div>
                  ) : (
                    <select
                      value={item.itemId}
                      onChange={(e) => {
                        const nextItem = getBossDropItemOption(e.target.value);
                        patchLootItem(item.id, {
                          itemId: e.target.value,
                          name: nextItem?.label ?? '',
                        });
                      }}
                      disabled={!canEditLoot}
                      className="h-11 min-w-0 rounded-xl border border-line bg-card px-3 text-sm font-medium text-t1 focus:outline-none focus:ring-2 focus:ring-amber-400/30 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="">드랍템 선택</option>
                      {dropItemOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  )}
                  <Input
                    className="!h-11 !py-0"
                    value={formatLootPriceUnit(item.sellPrice)}
                    onChange={(e) =>
                      patchLootItem(item.id, {
                        sellPrice: parseLootPriceUnit(e.target.value),
                      })
                    }
                    placeholder="0"
                    suffix="천만"
                    inputMode="decimal"
                    disabled={!canEditLoot}
                  />
                  <button
                    type="button"
                    onClick={() => removeLootItem(item.id)}
                    disabled={!canEditLoot}
                    className="h-11 shrink-0 rounded-xl border border-red-500/20 bg-red-500/10 px-3 text-xs font-semibold text-red-600 transition-colors hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    삭제
                  </button>
                </div>
                {item.itemId && <p className="mt-2 text-[11px] text-t3">선택: {getBossDropItemOption(item.itemId)?.label ?? item.name}</p>}
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[11px] text-t3">추가한 드랍템은 자동으로 획득 처리돼요. 놀긍, 프악공, 경쿠 같은 기타 잡템도 여기에 넣으면 돼요.</p>
          <div className="flex items-center gap-2">
            
            <button
              type="button"
              onClick={() => addLootItem()}
              disabled={!canEditLoot}
              className="rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-600 transition-colors hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              + 품목 추가
            </button>
            <button
              type="button"
              onClick={addMiscLootItem}
              disabled={!canEditLoot}
              className="rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-600 transition-colors hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              + 기타 잡템
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-t1">선택한 보스</p>
            <p className="text-[11px] text-t3">체크된 항목만 아래에 모아봤어요</p>
          </div>
          <p className="text-xs text-t3">{selectedEntries.length}개 항목</p>
        </div>

        {selectedEntries.length === 0 ? (
          <div className="rounded-xl bg-surface/50 py-8 text-center">
            <p className="text-sm text-t3">아직 체크한 보스가 없어요</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {selectedEntries.map((entry, index) => (
              <div key={`${entry.bossName}-${entry.difficulty}-${index}`} className="flex items-center justify-between rounded-xl border border-line bg-surface/35 px-3 py-2.5">
                <div>
                  <p className="text-sm font-semibold text-t1">{entry.bossName}</p>
                  <p className="text-[11px] text-t3">
                    {entry.category === 'general' ? '일반 보스' : entry.category === 'subboss' ? '검밑솔' : '그란디스'} · {entry.difficulty.toUpperCase()} · 파티원 {entry.partySize}
                  </p>
                </div>
                <p className="text-sm font-bold text-t1">{formatMeso(entry.revenue)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
        </>
      )}
    </main>
  );
}

function MetricCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl bg-card/80 p-3 ${highlight ? 'ring-1 ring-amber-500/20' : ''}`}>
      <p className="text-[11px] text-t3">{label}</p>
      <p className="mt-1 text-lg font-bold text-t1">{value}</p>
    </div>
  );
}

function difficultyColor(difficulty: BossDifficultyKey) {
  switch (difficulty) {
    case 'easy':
      return 'linear-gradient(135deg,#767676,#4f4f4f)';
    case 'normal':
      return 'linear-gradient(135deg,#889db9,#6b82a0)';
    case 'hard':
      return 'linear-gradient(135deg,#c06c96,#a94d7b)';
    case 'extreme':
      return 'linear-gradient(135deg,#ee4b4b,#c81e1e)';
  }
}

function formatLootPriceUnit(value: number) {
  if (!value || value <= 0) return '';
  const unitValue = value / LOOT_PRICE_UNIT;
  const rounded = Math.round(unitValue * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function parseLootPriceUnit(value: string) {
  const normalized = value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
  if (!normalized) return 0;
  const unitValue = Number(normalized);
  if (!Number.isFinite(unitValue) || unitValue <= 0) return 0;
  return Math.round(unitValue * LOOT_PRICE_UNIT);
}

function LootThumb({ itemId, label }: { itemId: string; label: string }) {
  const option = getBossDropItemOption(itemId);
  const [failed, setFailed] = useState(false);
  const imageUrl = option?.imageUrl;

  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-card text-[10px] font-bold text-t2">
      {imageUrl && !failed ? (
        <img
          src={imageUrl}
          alt={option?.label ?? label ?? '드랍템'}
          className="h-full w-full object-contain"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="px-1 text-center leading-tight">{option?.iconLabel ?? 'IMG'}</span>
      )}
    </div>
  );
}
