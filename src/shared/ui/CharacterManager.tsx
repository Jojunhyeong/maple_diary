'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { useAuthStore } from '@/shared/lib/stores/useAuthStore';
import { recordQueryKeys } from '@/shared/lib/queries/useRecordsQuery';
import {
  accountMesoQueryKeys,
  applyLocalAccountMesoDelta,
} from '@/shared/lib/queries/useAccountMesoQuery';
import {
  useCharacterMutations,
  useCharactersQuery,
} from '@/shared/lib/queries/useCharactersQuery';
import {
  backfillRecordsCharacterId,
  deleteRecordsByCharacterId,
  getRecordsByOwner,
  migrateRecordsCharacterId,
} from '@/shared/lib/db/local';
import { formatDate } from '@/shared/lib/utils/formatters';
import { enrichRecordWithCalculations } from '@/shared/lib/utils/calculations';
import {
  CHARACTER_STORAGE_KEYS,
  clearCharacterSelection,
  isUuidLike,
  normalizeLocalCharacterProfiles,
  readActiveCharacterId,
  readLocalCharacters,
  writeLocalCharacters,
  type LocalCharacterProfile,
} from '@/shared/lib/character-storage';

type ManagedCharacter = LocalCharacterProfile & {
  id: string;
  is_active?: boolean;
};

type CharacterManagerProps = {
  variant?: 'full' | 'compact';
  headingId?: string;
};

function getCharacterKey(character: Partial<ManagedCharacter>) {
  return character.id || '';
}

function toLocalCharacter(character: Record<string, unknown>): ManagedCharacter {
  const history = Array.isArray(character.character_exp_history)
    ? character.character_exp_history
        .filter(
          (entry) =>
            entry &&
            typeof entry === 'object' &&
            typeof (entry as { date?: unknown }).date === 'string' &&
            typeof (entry as { exp_gain_percent?: unknown }).exp_gain_percent === 'number',
        )
        .map((entry) => ({
          date: (entry as { date: string }).date,
          exp_gain_percent: (entry as { exp_gain_percent: number }).exp_gain_percent,
        }))
    : null;
  const name = typeof character.character_name === 'string' ? character.character_name : 'Unknown';
  return {
    id: typeof character.id === 'string' && isUuidLike(character.id) ? character.id : crypto.randomUUID(),
    character_name: name,
    character_ocid: typeof character.character_ocid === 'string' || character.character_ocid === null ? character.character_ocid : null,
    character_world: typeof character.character_world === 'string' || character.character_world === null ? character.character_world : null,
    character_class:
      typeof character.class === 'string'
        ? character.class
        : typeof character.character_class === 'string'
          ? character.character_class
          : 'Unknown',
    character_level:
      typeof character.level === 'number'
        ? character.level
        : typeof character.character_level === 'number'
          ? character.character_level
          : 1,
    character_exp_rate:
      typeof character.character_exp_rate === 'number' ||
      typeof character.character_exp_rate === 'string' ||
      character.character_exp_rate === null
        ? character.character_exp_rate
        : null,
    character_combat_power:
      typeof character.character_combat_power === 'number' || character.character_combat_power === null
        ? character.character_combat_power
        : null,
    character_exp_history: history,
    image_url:
      typeof character.image_url === 'string' || character.image_url === null
        ? character.image_url
        : typeof character.character_image === 'string'
          ? character.character_image
          : null,
    profile_set_at:
      typeof character.created_at === 'string'
        ? character.created_at
        : new Date().toISOString(),
    is_active: Boolean(character.is_active),
  };
}

function syncLegacyProfile(character: ManagedCharacter) {
  const legacyProfile = {
    character_name: character.character_name,
    character_ocid: character.character_ocid ?? null,
    character_world: character.character_world ?? null,
    character_class: character.character_class,
    character_level: character.character_level,
    character_exp_rate: character.character_exp_rate ?? null,
    character_combat_power: character.character_combat_power ?? null,
    character_exp_history: character.character_exp_history ?? null,
    image_url: character.image_url ?? null,
    profile_set_at: character.profile_set_at || new Date().toISOString(),
  };

  localStorage.setItem(CHARACTER_STORAGE_KEYS.LEGACY_PROFILE, JSON.stringify(legacyProfile));
  localStorage.setItem(CHARACTER_STORAGE_KEYS.ACTIVE_CHARACTER_ID, getCharacterKey(character));
}

function parsePercentValue(value?: number | string | null) {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatPercent(value?: number | string | null) {
  const parsed = parsePercentValue(value);
  return `${new Intl.NumberFormat('ko-KR', {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
  }).format(parsed)}%`;
}

function formatChartDate(date: string) {
  const parsed = new Date(date);
  return `${parsed.getMonth() + 1}/${parsed.getDate()}`;
}

function formatCompactNumber(value?: number | null) {
  if (value === null || value === undefined) return '0';
  return new Intl.NumberFormat('ko-KR').format(value);
}

const CHARACTER_CACHE_KEY = 'maple_diary:maple_character_cache:v1';

type CachedCharacterPayload = { expiresAt: number; data: Record<string, unknown> };

async function fetchMapleCharacter(nickname: string, forceRefresh = false) {
  const key = nickname.trim().toLowerCase();
  if (!forceRefresh && typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(CHARACTER_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, CachedCharacterPayload>;
        const cached = parsed[key];
        if (cached?.expiresAt && cached.expiresAt > Date.now() && cached.data) {
          return cached.data;
        }
      }
    } catch {
      // ignore cache errors
    }
  }

  const res = await fetch(`/api/maple/character?name=${encodeURIComponent(nickname)}${forceRefresh ? '&refresh=1' : ''}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 429) {
      throw new Error(data.error || '캐릭터 정보를 너무 자주 조회했어요. 잠시 후 다시 시도해주세요.');
    }
    throw new Error(data.error || '캐릭터를 찾을 수 없습니다');
  }
  const data = await res.json();
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(CHARACTER_CACHE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Record<string, CachedCharacterPayload>) : {};
      const expiresAt = forceRefresh
        ? (() => {
            const next = new Date();
            next.setHours(23, 59, 59, 999);
            return next.getTime();
          })()
        : Date.now() + 1000 * 60 * 60 * 24;
      parsed[key] = { data, expiresAt };
      localStorage.setItem(CHARACTER_CACHE_KEY, JSON.stringify(parsed));
    } catch {
      // ignore cache errors
    }
  }
  return data;
}

export function CharacterManager({ variant = 'full', headingId }: CharacterManagerProps) {
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user?.id;
  const { localOwnerId } = useAuthStore();
  const queryClient = useQueryClient();
  const {
    data: charactersPayload,
    isLoading: isCharactersLoading,
    error: charactersQueryError,
  } = useCharactersQuery({ userId: session?.user?.id, isLoggedIn });
  const { saveCharacter, deleteCharacter } = useCharacterMutations({ isLoggedIn });
  const [characters, setCharacters] = useState<ManagedCharacter[]>([]);
  const [activeCharacterId, setActiveCharacterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [drawerPhase, setDrawerPhase] = useState<'closed' | 'opening' | 'open' | 'closing'>('closed');
  const drawerCloseTimerRef = useRef<number | null>(null);
  const drawerOpenTimerRef = useRef<number | null>(null);

  const activeCharacter = useMemo(
    () => characters.find((character) => getCharacterKey(character) === activeCharacterId) || characters[0] || null,
    [characters, activeCharacterId],
  );

  useEffect(() => {
    if (isLoggedIn && !charactersPayload) {
      setLoading(isCharactersLoading);
      if (charactersQueryError) setError(charactersQueryError.message);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError('');

      try {
        if (isLoggedIn) {
          const data = charactersPayload!;
          const loaded: ManagedCharacter[] = Array.isArray(data.characters)
            ? data.characters.map(toLocalCharacter)
            : [];
          const explicitActive = data.activeCharacter?.id || null;
          const fallbackActive = loaded.find((character) => character.is_active) || loaded[0] || null;
          const storedActive = readActiveCharacterId();
          const activeKey =
            (explicitActive && loaded.some((character) => getCharacterKey(character) === explicitActive) ? explicitActive : null) ||
            (storedActive && isUuidLike(storedActive) && loaded.some((character) => getCharacterKey(character) === storedActive)
              ? storedActive
              : null) ||
            (fallbackActive ? getCharacterKey(fallbackActive) : null);

          const nextActive = loaded.find((character) => getCharacterKey(character) === activeKey) || loaded[0] || null;

          setCharacters(loaded);
          setActiveCharacterId(activeKey);

          if (loaded.length > 0) {
            writeLocalCharacters(loaded, activeKey);
            if (nextActive) syncLegacyProfile(nextActive);
          }

          if (isLoggedIn && nextActive && getCharacterKey(nextActive) === activeKey) {
            void fetch('/api/characters', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...nextActive,
                is_active: true,
              }),
            }).catch(() => {
              // ignore background sync errors
            });
          }
        } else {
          const rawCharacters = readLocalCharacters();
          const normalizedCharacters: ManagedCharacter[] = normalizeLocalCharacterProfiles(rawCharacters).map((character) => ({
            ...character,
            id: character.id,
            is_active: character.is_active ?? false,
          }));
          const idMap = new Map<string, string>();
          rawCharacters.forEach((character, index) => {
            const rawKey = character.id || character.character_ocid || character.character_name || '';
            const nextKey = normalizedCharacters[index]?.id || '';
            if (rawKey && nextKey && rawKey !== nextKey) {
              idMap.set(rawKey, nextKey);
            }
          });
          const fallbackActive = normalizedCharacters.find((character) => character.is_active) || normalizedCharacters[0] || null;
          const storedActive = readActiveCharacterId();
          const remappedActive = storedActive ? idMap.get(storedActive) || storedActive : null;
          const activeKey =
            (remappedActive && normalizedCharacters.some((character) => getCharacterKey(character) === remappedActive)
              ? remappedActive
              : null) ||
            (fallbackActive ? getCharacterKey(fallbackActive) : null);

          if (localOwnerId && idMap.size > 0) {
            for (const [fromId, toId] of idMap.entries()) {
              await migrateRecordsCharacterId(localOwnerId, fromId, toId);
            }
          }

          const nextActive = normalizedCharacters.find((character) => getCharacterKey(character) === activeKey) || normalizedCharacters[0] || null;

          setCharacters(normalizedCharacters);
          setActiveCharacterId(activeKey);
          if (normalizedCharacters.length > 0) {
            writeLocalCharacters(normalizedCharacters, activeKey);
            if (nextActive) syncLegacyProfile(nextActive);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '불러오기 실패');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [charactersPayload, charactersQueryError, isCharactersLoading, isLoggedIn, localOwnerId]);

  useEffect(() => {
    if (drawerPhase === 'closed') return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [drawerPhase]);

  useEffect(() => {
    return () => {
      if (drawerCloseTimerRef.current) {
        window.clearTimeout(drawerCloseTimerRef.current);
      }
      if (drawerOpenTimerRef.current) {
        window.clearTimeout(drawerOpenTimerRef.current);
      }
    };
  }, []);

  const persistLocalSelection = (nextCharacters: ManagedCharacter[], selected: ManagedCharacter) => {
    const activeKey = getCharacterKey(selected);
    const normalized = nextCharacters.map((character) => ({
      ...character,
      is_active: getCharacterKey(character) === activeKey,
    }));

    setCharacters(normalized);
    setActiveCharacterId(activeKey);
    writeLocalCharacters(normalized, activeKey);
    syncLegacyProfile(selected);
  };

  const syncAfterDelete = (nextCharacters: ManagedCharacter[], nextActive: ManagedCharacter | null) => {
    setCharacters(nextCharacters.map((character) => ({
      ...character,
      is_active: nextActive ? getCharacterKey(character) === getCharacterKey(nextActive) : false,
    })));
    setActiveCharacterId(nextActive ? getCharacterKey(nextActive) : null);

    if (!nextActive) {
      clearCharacterSelection();
      return;
    }

    writeLocalCharacters(
      nextCharacters.map((character) => ({
        ...character,
        is_active: getCharacterKey(character) === getCharacterKey(nextActive),
      })),
      getCharacterKey(nextActive),
    );
    syncLegacyProfile(nextActive);
  };

  const handleSelect = async (character: ManagedCharacter) => {
    const activeKey = getCharacterKey(character);
    setSavingId(activeKey);
    setError('');

    try {
      if (isLoggedIn) {
        await saveCharacter({ ...character, is_active: true });
      }

      const nextCharacters = characters.map((item) => ({
        ...item,
        is_active: getCharacterKey(item) === activeKey,
      }));
      persistLocalSelection(nextCharacters, character);
    } catch (err) {
      setError(err instanceof Error ? err.message : '캐릭터 선택 실패');
    } finally {
      setSavingId(null);
    }
  };

  const handleAdd = async () => {
    const trimmed = nickname.trim();
    if (!trimmed) {
      setError('캐릭터 닉네임을 입력해줘');
      return;
    }

    setAdding(true);
    setError('');

    try {
      const latest = await fetchMapleCharacter(trimmed);
      const previousActive = activeCharacter || characters[0] || null;
      const today = formatDate(new Date());
      const initialExpRate = parsePercentValue(latest.character_exp_rate ?? 0);
      const nextCharacter: ManagedCharacter = {
        id: crypto.randomUUID(),
        character_name: latest.character_name,
        character_ocid: latest.ocid ?? null,
        character_world: latest.character_world ?? null,
        character_class: latest.character_class,
        character_level: latest.character_level,
        character_exp_rate: latest.character_exp_rate ?? null,
        character_combat_power: latest.character_combat_power ?? null,
        image_url: latest.character_image ?? null,
        character_exp_history: [
          {
            date: today,
            exp_gain_percent: initialExpRate,
          },
        ],
        profile_set_at: new Date().toISOString(),
        is_active: true,
      };

      if (isLoggedIn) {
        const data = await saveCharacter({ ...nextCharacter, is_active: true });
        if (data?.characterId && typeof data.characterId === 'string') {
          nextCharacter.id = data.characterId;
        }
      } else if (localOwnerId && previousActive) {
        await backfillRecordsCharacterId(localOwnerId, getCharacterKey(previousActive));
      }

      const nextCharacters = [...characters, nextCharacter].map((character) => ({
        ...character,
        is_active: getCharacterKey(character) === getCharacterKey(nextCharacter),
      }));

      persistLocalSelection(nextCharacters, nextCharacter);
      setNickname('');
      setAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '캐릭터 추가 실패');
      setAdding(false);
    }
  };

  const handleDelete = async (character: ManagedCharacter) => {
    const characterKey = getCharacterKey(character);
    const shouldDelete = window.confirm(`"${character.character_name}" 캐릭터를 삭제할까요? 기록도 함께 삭제됩니다.`);
    if (!shouldDelete) return;

    setDeletingId(characterKey);
    setError('');

    try {
      const matchingCharacters = characters.filter((item) => {
        if (getCharacterKey(item) === characterKey) return true;
        if (character.character_ocid && item.character_ocid && item.character_ocid === character.character_ocid) return true;
        return !character.character_ocid && item.character_name === character.character_name;
      });
      const matchingCharacterKeys = matchingCharacters.map((item) => getCharacterKey(item)).filter(Boolean);

      if (isLoggedIn) {
        await deleteCharacter({
          characterId: characterKey,
          characterName: character.character_name,
          characterOcid: character.character_ocid ?? null,
        });
      }

      const remaining = characters.filter((item) => getCharacterKey(item) !== characterKey);
      const nextRemaining = remaining.filter((item) => !matchingCharacterKeys.includes(getCharacterKey(item)));
      const wasActive = characterKey === activeCharacterId;
      const nextActive = wasActive ? nextRemaining[0] || null : nextRemaining.find((item) => item.is_active) || nextRemaining[0] || null;

      if (isLoggedIn && wasActive && nextActive) {
        await saveCharacter({ ...nextActive, is_active: true });
      }

      if (!isLoggedIn && localOwnerId) {
        const localRecords = await getRecordsByOwner(localOwnerId);
        let shardPrice = 7_000_000;
        try {
          const settings = JSON.parse(localStorage.getItem('maple_diary:settings') || '{}') as { shard_price?: number };
          shardPrice = settings.shard_price ?? shardPrice;
        } catch {
          // Keep the default valuation used by hunting records.
        }
        for (const targetKey of matchingCharacterKeys) {
          const deletedRecords = localRecords.filter((record) => record.character_id === targetKey);
          await deleteRecordsByCharacterId(localOwnerId, targetKey);
          for (const record of deletedRecords) {
            const netRevenue = enrichRecordWithCalculations(record, shardPrice).net_revenue;
            applyLocalAccountMesoDelta(
              localOwnerId,
              -netRevenue,
              'hunting',
              record.id,
              '캐릭터 삭제로 사냥 기록 삭제',
            );
          }
        }
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: recordQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: accountMesoQueryKeys.all }),
      ]);

      syncAfterDelete(nextRemaining, nextActive);
    } catch (err) {
      setError(err instanceof Error ? err.message : '캐릭터 삭제 실패');
    } finally {
      setDeletingId(null);
    }
  };

  const expHistory = useMemo(() => {
    const history = activeCharacter?.character_exp_history ?? [];
    const ordered = [...history].sort((a, b) => a.date.localeCompare(b.date));
    if (!ordered.length) return [];
    const end = new Date(ordered[ordered.length - 1].date);
    end.setDate(end.getDate() - 6);
    return ordered.filter((entry) => new Date(entry.date) >= end);
  }, [activeCharacter?.character_exp_history]);
  const expHistoryMax = Math.max(...expHistory.map((entry) => entry.exp_gain_percent), 1);
  const expRate = activeCharacter?.character_exp_rate;
  const hasExpRate = expRate !== null && expRate !== undefined && expRate !== '' && Number.isFinite(Number(expRate));
  const renderExperienceHistoryCard = () => {
    if (!activeCharacter) return null;
    return (
      <section className="diary-character-experience" aria-label="경험치 성장">
        <div className="diary-character-section-title"><h3>경험치 성장</h3><span>최근 7일</span></div>
        <div className="diary-character-exp-value"><span>Lv. {activeCharacter.character_level} <span aria-hidden="true">→</span> Lv. {activeCharacter.character_level + 1}</span><strong>{hasExpRate ? formatPercent(expRate) : '—'}</strong></div>
        {hasExpRate ? <progress className="diary-character-progress" value={Math.max(0, Math.min(100, Number(expRate)))} max={100} aria-label="다음 레벨까지 경험치 진행률" /> : <p className="diary-character-muted">현재 경험치 정보가 없어요.</p>}
        <div className="diary-character-levels"><span>현재 {hasExpRate ? formatPercent(expRate) : '—'}</span><span>다음 레벨까지 {hasExpRate ? formatPercent(Math.max(0, 100 - Number(expRate))) : '—'}</span></div>
        <div className="diary-character-chart-heading"><h4>일별 경험치 증가</h4></div>
        {expHistory.length ? <>
          <div className="diary-character-exp-chart" role="group" aria-label="최근 7일 일별 경험치 증가율">
            {expHistory.map((item) => (
              <div className="diary-character-exp-day" key={item.date}>
                <div className="diary-character-bar-track">
                  <button type="button" className="diary-character-exp-bar" style={{ height: `${Math.max(0, item.exp_gain_percent) / expHistoryMax * 100}%` }} aria-label={`${item.date} 경험치 증가 ${formatPercent(item.exp_gain_percent)}`}>
                    <span className="diary-character-chart-tooltip">{formatChartDate(item.date)} · {formatPercent(item.exp_gain_percent)}</span>
                  </button>
                </div>
                <time dateTime={item.date}>{formatChartDate(item.date)}</time>
              </div>
            ))}
          </div>
        </> : <p className="diary-character-empty">최근 경험치 기록이 없어요.</p>}
      </section>
    );
  };
  const openDrawer = () => {
    if (drawerCloseTimerRef.current) {
      window.clearTimeout(drawerCloseTimerRef.current);
      drawerCloseTimerRef.current = null;
    }
    if (drawerOpenTimerRef.current) {
      window.clearTimeout(drawerOpenTimerRef.current);
      drawerOpenTimerRef.current = null;
    }
    setDrawerPhase('opening');
    drawerOpenTimerRef.current = window.setTimeout(() => {
      setDrawerPhase('open');
      drawerOpenTimerRef.current = null;
    }, 320);
  };
  const closeDrawer = () => {
    if (drawerPhase === 'closed') return;
    setDrawerPhase('closing');
    if (drawerCloseTimerRef.current) {
      window.clearTimeout(drawerCloseTimerRef.current);
    }
    drawerCloseTimerRef.current = window.setTimeout(() => {
      setDrawerPhase('closed');
      drawerCloseTimerRef.current = null;
    }, 280);
  };
  const drawerMarkup = (
    <div className="diary-character-selector fixed inset-0 z-[120] isolate">
      <button
        aria-label="캐릭터 선택 닫기"
        className={`absolute inset-0 z-0 bg-black/65 ${
          drawerPhase === 'opening'
            ? 'maple-drawer-backdrop-enter'
            : drawerPhase === 'closing'
              ? 'maple-drawer-backdrop-exit'
              : 'opacity-100'
        }`}
        onClick={closeDrawer}
      />

      <aside
        className={`absolute left-0 top-0 z-10 flex h-full w-full max-w-md flex-col bg-app shadow-[0_28px_60px_rgba(0,0,0,0.18)] md:rounded-r-[28px] ${
          drawerPhase === 'opening'
            ? 'maple-drawer-enter'
            : drawerPhase === 'closing'
              ? 'maple-drawer-exit'
              : 'translate-x-0 opacity-100'
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-t1">캐릭터 선택</p>
            <p className="text-xs text-t3">현재 캐릭터를 누르면 즉시 전환돼요</p>
          </div>
          <button
            type="button"
            onClick={closeDrawer}
            className="inline-flex h-9 items-center justify-center rounded-xl bg-transparent px-3 text-sm font-semibold text-t2 transition-colors hover:bg-surface/70 hover:text-t1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-app"
          >
            닫기
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-t3">캐릭터 불러오는 중...</p>
          ) : characters.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line-str bg-surface/50 p-4 text-center">
              <p className="text-sm font-semibold text-t2">아직 캐릭터가 없어요</p>
              <p className="mt-1 text-xs text-t3">아래에서 닉네임으로 추가해보세요</p>
            </div>
          ) : (
            <div className="space-y-2">
              {characters.map((character) => {
                const characterKey = getCharacterKey(character);
                const active = characterKey === activeCharacterId;
                return (
                  <div
                    key={characterKey}
                    className={`flex items-stretch gap-2 rounded-2xl border px-3 py-3 transition-all ${
                      active
                        ? 'border-amber-500/60 bg-amber-500/10 shadow-[0_10px_18px_rgba(245,158,11,0.12)]'
                        : 'border-line bg-surface/55 hover:border-amber-500/30 hover:bg-surface/75'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelect(character)}
                      disabled={savingId === characterKey || deletingId === characterKey}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      {character.image_url ? (
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-line bg-surface">
                          <Image
                            src={character.image_url}
                            alt={character.character_name}
                            fill
                            unoptimized
                            className="object-cover scale-[2.2] [image-rendering:pixelated]"
                          />
                        </div>
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-lg">
                          🍁
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-t1">{character.character_name}</p>
                          {active && (
                            <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-500">
                              현재
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-t3">
                          {character.character_class} · Lv. {character.character_level}
                        </p>
                      </div>
                    </button>

                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-t3">
                        {savingId === characterKey ? '저장중' : active ? '선택됨' : '선택'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDelete(character)}
                        disabled={deletingId === characterKey}
                        aria-label={`${character.character_name} 삭제`}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-500/15 bg-red-500/8 text-red-500 transition-colors hover:bg-red-500/14 hover:text-red-600 disabled:opacity-50"
                      >
                        {deletingId === characterKey ? (
                          <span className="text-[13px] leading-none">…</span>
                        ) : (
                          <svg
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.9"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M3 6h18" />
                            <path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6" />
                            <path d="M19 6l-1 14.5A1.5 1.5 0 0 1 16.5 22h-9A1.5 1.5 0 0 1 6 20.5L5 6" />
                            <path d="M10 11v5" />
                            <path d="M14 11v5" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

          <div className="mt-5 rounded-2xl border border-line bg-surface/45 p-3">
            <p className="mb-3 text-sm font-semibold text-t2">새 캐릭터 추가</p>
            <div className="space-y-3">
              <Input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="메이플 닉네임"
                label="닉네임"
                disabled={adding}
              />
              <Button
                fullWidth
                onClick={handleAdd}
                disabled={adding || !nickname.trim()}
              >
                {adding ? '불러오는 중...' : '추가하고 기본으로 설정'}
              </Button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );

  return (
    <>
      <section className={`diary-character-panel ${variant === 'compact' ? 'diary-character-panel-compact' : ''}`} aria-label="캐릭터 프로필">
        <div className="diary-character-section-title diary-character-profile-heading">
          <h2 id={headingId}>내 캐릭터</h2>
          <Button variant="secondary" size="sm" onClick={openDrawer}>캐릭터 변경</Button>
        </div>
        <div className="diary-character-identity">
          <div className="diary-character-portrait">
            {activeCharacter?.image_url ? <Image src={activeCharacter.image_url} alt={activeCharacter.character_name} fill unoptimized sizes="220px" className="object-contain [image-rendering:pixelated]" /> : <span aria-hidden="true">🍁</span>}
          </div>
          <div>
            <h2>{activeCharacter?.character_name || (loading ? '캐릭터 불러오는 중…' : '등록된 캐릭터 없음')}</h2>
            <p>{activeCharacter ? `Lv. ${activeCharacter.character_level} · ${activeCharacter.character_class} · ${activeCharacter.character_world || '월드 미지정'}` : '캐릭터를 추가해 주세요.'}</p>
            {activeCharacter && <div className="diary-character-combat"><span>전투력</span><strong>{activeCharacter.character_combat_power == null ? '—' : formatCompactNumber(activeCharacter.character_combat_power)}</strong></div>}
          </div>
        </div>
        {variant === 'full' && <div className="diary-character-storage"><span>등록된 캐릭터 <strong>{characters.length}개</strong></span><span>{isLoggedIn ? '계정에 동기화됨' : '이 브라우저에 저장됨'}</span></div>}
        {renderExperienceHistoryCard()}
      </section>
      {drawerPhase !== 'closed' && drawerMarkup}
    </>
  );
}
