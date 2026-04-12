'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Input } from '@/shared/ui/Input';
import { useAuthStore } from '@/shared/lib/stores/useAuthStore';
import { useRecordStore } from '@/shared/lib/stores/useRecordStore';
import { backfillRecordsCharacterId, deleteRecordsByCharacterId } from '@/shared/lib/db/local';
import {
  CHARACTER_STORAGE_KEYS,
  clearCharacterSelection,
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
};

function getCharacterKey(character: Partial<ManagedCharacter>) {
  return character.id || character.character_ocid || character.character_name || '';
}

function toLocalCharacter(character: Record<string, unknown>): ManagedCharacter {
  const name = typeof character.character_name === 'string' ? character.character_name : 'Unknown';
  return {
    id: typeof character.id === 'string' ? character.id : getCharacterKey(character),
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

function formatCompactNumber(value?: number | null) {
  if (value === null || value === undefined) return '0';
  return new Intl.NumberFormat('ko-KR').format(value);
}

async function fetchMapleCharacter(nickname: string) {
  const res = await fetch(`/api/maple/character?name=${encodeURIComponent(nickname)}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || '캐릭터를 찾을 수 없습니다');
  }
  return res.json();
}

export function CharacterManager({ variant = 'full' }: CharacterManagerProps) {
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user?.id;
  const { localOwnerId } = useAuthStore();
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
    const load = async () => {
      setLoading(true);
      setError('');

      try {
        if (isLoggedIn) {
          const res = await fetch('/api/characters');
          if (!res.ok) throw new Error('캐릭터를 불러오지 못했습니다');

          const data = await res.json();
          const loaded: ManagedCharacter[] = Array.isArray(data.characters)
            ? data.characters.map(toLocalCharacter)
            : [];
          const explicitActive =
            data.activeCharacter?.id ||
            data.activeCharacter?.character_ocid ||
            data.activeCharacter?.character_name ||
            readActiveCharacterId() ||
            null;
          const fallbackActive = loaded.find((character) => character.is_active) || loaded[0] || null;
          const activeKey = explicitActive || (fallbackActive ? getCharacterKey(fallbackActive) : null);

          setCharacters(loaded);
          setActiveCharacterId(activeKey);

          if (loaded.length > 0) {
            writeLocalCharacters(loaded, activeKey);
            const nextActive = loaded.find((character) => getCharacterKey(character) === activeKey) || loaded[0];
            if (nextActive) syncLegacyProfile(nextActive);
          }
        } else {
          const loaded: ManagedCharacter[] = readLocalCharacters().map((character) => ({
            ...character,
            id: character.id || character.character_ocid || character.character_name,
            is_active: character.is_active ?? false,
          }));
          const fallbackActive = loaded.find((character) => character.is_active) || loaded[0] || null;
          const activeKey = readActiveCharacterId() || (fallbackActive ? getCharacterKey(fallbackActive) : null);

          setCharacters(loaded);
          setActiveCharacterId(activeKey);
          if (loaded.length > 0) {
            writeLocalCharacters(loaded, activeKey);
            const nextActive = loaded.find((character) => getCharacterKey(character) === activeKey) || loaded[0];
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
  }, [isLoggedIn]);

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
        const res = await fetch('/api/characters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...character,
            is_active: true,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || '캐릭터 선택에 실패했습니다');
        }
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
      const nextCharacter: ManagedCharacter = {
        id: latest.ocid || latest.character_name,
        character_name: latest.character_name,
        character_ocid: latest.ocid ?? null,
        character_world: latest.character_world ?? null,
        character_class: latest.character_class,
        character_level: latest.character_level,
        character_exp_rate: latest.character_exp_rate ?? null,
        character_combat_power: latest.character_combat_power ?? null,
        image_url: latest.character_image ?? null,
        profile_set_at: new Date().toISOString(),
        is_active: true,
      };

      if (isLoggedIn) {
        const res = await fetch('/api/characters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...nextCharacter,
            is_active: true,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || '캐릭터 저장에 실패했습니다');
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
      if (isLoggedIn) {
        const res = await fetch(`/api/characters/${encodeURIComponent(characterKey)}`, {
          method: 'DELETE',
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || '캐릭터 삭제에 실패했습니다');
        }
      }

      const remaining = characters.filter((item) => getCharacterKey(item) !== characterKey);
      const wasActive = characterKey === activeCharacterId;
      const nextActive = wasActive ? remaining[0] || null : remaining.find((item) => item.is_active) || remaining[0] || null;

      if (isLoggedIn && wasActive && nextActive) {
        const activateRes = await fetch('/api/characters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...nextActive,
            is_active: true,
          }),
        });

        if (!activateRes.ok) {
          const data = await activateRes.json().catch(() => ({}));
          throw new Error(data.error || '다음 캐릭터 활성화에 실패했습니다');
        }
      }

      if (!isLoggedIn && localOwnerId) {
        await deleteRecordsByCharacterId(localOwnerId, characterKey);
      }

      useRecordStore.setState((state) => ({
        records: state.records.filter((record) => record.character_id !== characterKey),
      }));

      syncAfterDelete(remaining, nextActive);
    } catch (err) {
      setError(err instanceof Error ? err.message : '캐릭터 삭제 실패');
    } finally {
      setDeletingId(null);
    }
  };

  const wrapperClass =
    variant === 'compact'
      ? 'maple-panel rounded-[32px] border border-[#ead9bf] bg-card/96 p-4 shadow-[0_12px_30px_rgba(92,63,31,0.12)]'
      : 'maple-panel rounded-[28px] border border-line bg-card/90 p-5 shadow-[var(--shadow-md)]';
  const expRateValue = parsePercentValue(activeCharacter?.character_exp_rate);
  const expRateFill = Math.min(Math.max(expRateValue, 0), 100);
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
    <div className="fixed inset-0 z-[120] isolate">
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

  if (variant === 'compact') {
    return (
      <>
        <Card className={wrapperClass}>
          <div className="rounded-[30px] border border-[#ead9bf] bg-[linear-gradient(180deg,rgba(255,252,248,0.98),rgba(248,241,228,0.96))] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
            <div className="flex items-center justify-between gap-3">
              <p className="maple-badge inline-flex rounded-full border border-[#f5c58e] bg-[linear-gradient(180deg,rgba(255,238,223,0.96),rgba(255,248,240,0.92))] px-2.5 py-1 text-[11px] font-semibold tracking-[-0.01em] text-[#d97706] shadow-[0_1px_0_rgba(255,255,255,0.8)_inset]">
                🍁 My Character
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={openDrawer}
                className="h-8 rounded-full px-3 text-[11px]"
              >
                캐릭터 선택
              </Button>
            </div>

            <div className="mt-5 grid grid-cols-[112px_1fr] items-center gap-4">
              {activeCharacter?.image_url ? (
                <div className="relative h-[116px] w-[116px] shrink-0 overflow-hidden rounded-[24px] border border-[#e8ddc6] bg-[#f1eadc] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
                  <Image
                    src={activeCharacter.image_url}
                    alt={activeCharacter.character_name}
                    fill
                    unoptimized
                    className="object-cover scale-[2.18] [image-rendering:pixelated]"
                  />
                </div>
              ) : (
                <div className="flex h-[116px] w-[116px] shrink-0 items-center justify-center rounded-[24px] border border-[#e8ddc6] bg-[#f1eadc] text-3xl shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
                  🍁
                </div>
              )}

              <div className="min-w-0 pt-1">
                <h2 className="truncate text-[23px] font-extrabold leading-[1.05] tracking-[-0.05em] text-[#3a2517]">
                  {activeCharacter?.character_name || '등록된 캐릭터 없음'}
                </h2>
                <p className="mt-2 truncate text-[14px] font-medium tracking-[-0.03em] text-[#8b6f59]">
                  {activeCharacter?.character_class || (isLoggedIn ? '로그인 후 캐릭터를 추가해줘' : '캐릭터를 추가해줘')}
                </p>
                {activeCharacter && (
                  <p className="mt-2 text-[18px] font-bold tracking-[-0.05em] text-[#e98312]">
                    Lv. {activeCharacter.character_level}
                  </p>
                )}
              </div>
            </div>

            {activeCharacter ? (
              <div className="mt-5 grid grid-cols-2 gap-2.5">
                <div className="rounded-[20px] border border-[#e8ddc6] bg-[linear-gradient(180deg,rgba(255,252,248,0.96),rgba(247,241,231,0.96))] px-3.5 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                  <p className="text-[11px] font-medium text-[#b8a28e]">월드</p>
                  <p className="mt-1.5 text-[15px] font-semibold tracking-[-0.04em] text-[#3a2517]">
                    {activeCharacter.character_world || '미지정'}
                  </p>
                </div>
                <div className="rounded-[20px] border border-[#e8ddc6] bg-[linear-gradient(180deg,rgba(255,252,248,0.96),rgba(247,241,231,0.96))] px-3.5 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                  <p className="text-[11px] font-medium text-[#b8a28e]">레벨</p>
                  <p className="mt-1.5 text-[15px] font-semibold tracking-[-0.04em] text-[#3a2517]">
                    Lv. {activeCharacter.character_level}
                  </p>
                </div>
                <div className="rounded-[20px] border border-[#e8ddc6] bg-[linear-gradient(180deg,rgba(255,252,248,0.96),rgba(247,241,231,0.96))] px-3.5 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                  <p className="text-[11px] font-medium text-[#b8a28e]">직업</p>
                  <p className="mt-1.5 truncate text-[15px] font-semibold tracking-[-0.04em] text-[#3a2517]">
                    {activeCharacter.character_class}
                  </p>
                </div>
                <div className="rounded-[20px] border border-[#e8ddc6] bg-[linear-gradient(180deg,rgba(255,252,248,0.96),rgba(247,241,231,0.96))] px-3.5 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                  <p className="text-[11px] font-medium text-[#b8a28e]">전투력</p>
                  <p className="mt-1.5 whitespace-nowrap text-[15px] font-semibold tracking-[-0.04em] text-[#3a2517]">
                    {formatCompactNumber(activeCharacter.character_combat_power)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-[20px] border border-[#e8ddc6] bg-[linear-gradient(180deg,rgba(255,252,248,0.96),rgba(247,241,231,0.96))] p-4 text-center text-sm text-[#8b6f59] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                아직 선택된 캐릭터가 없어요
              </div>
            )}

            {activeCharacter && (
              <div className="mt-3 rounded-[20px] border border-[#e8ddc6] bg-[linear-gradient(180deg,rgba(255,252,248,0.96),rgba(247,241,231,0.96))] px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-medium text-[#b8a28e]">경험치</p>
                  <p className="text-[11px] font-semibold text-[#8b6f59]">{formatPercent(activeCharacter.character_exp_rate)}</p>
                </div>
                <div className="mt-2.5 h-3.5 rounded-full bg-white/95 p-0.5">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#f59e0b_0%,#ef4444_100%)]"
                    style={{ width: `${expRateFill}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </Card>

        {drawerPhase !== 'closed' && drawerMarkup}
      </>
    );
  }

  return (
    <>
      <Card className={wrapperClass}>
        <div className="rounded-[24px] border border-amber-500/15 bg-[linear-gradient(160deg,rgba(245,158,11,0.18),rgba(245,158,11,0.06)_44%,rgba(255,255,255,0.18))] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="maple-badge inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold text-amber-600">
                🍁 현재 캐릭터
              </p>
              {activeCharacter ? (
                <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-semibold text-amber-600">
                  선택됨
                </span>
              ) : (
                <span className="rounded-full bg-surface/80 px-2.5 py-1 text-[10px] font-semibold text-t3">
                  아직 선택 없음
                </span>
              )}
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={openDrawer}
              className="shrink-0 whitespace-nowrap"
            >
              캐릭터 선택
            </Button>
          </div>

          <div className="mt-4 flex items-start gap-3 sm:gap-4">
            {activeCharacter?.image_url ? (
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[26px] border border-line bg-surface shadow-[0_12px_24px_rgba(245,158,11,0.14)]">
                <Image
                  src={activeCharacter.image_url}
                  alt={activeCharacter.character_name}
                  fill
                  unoptimized
                  className="object-cover scale-[2.25] [image-rendering:pixelated]"
                />
              </div>
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[26px] border border-line bg-surface text-2xl shadow-[0_12px_24px_rgba(245,158,11,0.1)]">
                🍁
              </div>
            )}

            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[22px] font-bold tracking-[-0.04em] text-t1">
                {activeCharacter?.character_name || '등록된 캐릭터 없음'}
              </h2>
              <p className="mt-1 truncate text-xs text-t3">
                {activeCharacter
                  ? `${activeCharacter.character_world || '월드 미지정'} · ${activeCharacter.character_class}`
                  : (isLoggedIn ? '로그인 계정과 동기화됩니다' : '이 브라우저에 저장됩니다')}
              </p>
              {activeCharacter && (
                <p className="mt-1 text-sm font-semibold tracking-[-0.03em] text-amber-600">
                  Lv. {activeCharacter.character_level}
                </p>
              )}

              {activeCharacter && (
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-[20px] border border-line bg-card/82 px-3 py-2.5 text-center shadow-[0_1px_0_rgba(255,255,255,0.45)_inset]">
                    <p className="text-[10px] text-t3">레벨</p>
                    <p className="mt-1 text-[15px] font-bold tracking-[-0.03em] text-t1">Lv. {activeCharacter.character_level}</p>
                  </div>
                  <div className="rounded-[20px] border border-line bg-card/82 px-3 py-2.5 text-center shadow-[0_1px_0_rgba(255,255,255,0.45)_inset]">
                    <p className="text-[10px] text-t3">경험치</p>
                    <p className="mt-1 text-[15px] font-bold tracking-[-0.03em] text-t1">{formatPercent(activeCharacter.character_exp_rate)}</p>
                  </div>
                  <div className="rounded-[20px] border border-line bg-card/82 px-3 py-2.5 text-center shadow-[0_1px_0_rgba(255,255,255,0.45)_inset]">
                    <p className="text-[10px] text-t3">전투력</p>
                    <p className="mt-1 truncate text-[15px] font-bold tracking-[-0.03em] text-t1">{formatCompactNumber(activeCharacter.character_combat_power)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {variant === 'full' && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-line bg-surface/50 p-3">
              <p className="text-[11px] text-t3">등록된 캐릭터</p>
              <p className="mt-1 text-sm font-bold text-t1">{characters.length}개</p>
            </div>
            <div className="rounded-2xl border border-line bg-surface/50 p-3">
              <p className="text-[11px] text-t3">저장 위치</p>
              <p className="mt-1 text-sm font-bold text-t1">{isLoggedIn ? 'DB 동기화' : '로컬 저장'}</p>
            </div>
          </div>
        )}
      </Card>

      {drawerPhase !== 'closed' && drawerMarkup}
    </>
  );
}
