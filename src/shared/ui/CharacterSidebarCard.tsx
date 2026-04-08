'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';

interface UserProfile {
  character_name?: string;
  character_world?: string | null;
  character_class?: string;
  character_level?: number;
  image_url?: string;
  character_exp_rate?: number | string;
  character_combat_power?: number | null;
}

function parseExpRate(value: UserProfile['character_exp_rate']) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.min(100, n));
}

function formatCombatPower(value: number | null | undefined) {
  if (value === null || value === undefined) return '정보 없음';
  return value.toLocaleString('ko-KR');
}

export function CharacterSidebarCard() {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const load = () => {
      try {
        const raw = localStorage.getItem('maple_diary:user_profile');
        setProfile(raw ? JSON.parse(raw) : null);
      } catch {
        setProfile(null);
      }
    };

    load();
    window.addEventListener('storage', load);
    return () => window.removeEventListener('storage', load);
  }, []);

  useEffect(() => {
    if (!profile?.character_name) return;

    const needsHydration =
      profile.character_combat_power === null ||
      profile.character_combat_power === undefined ||
      profile.character_exp_rate === null ||
      profile.character_exp_rate === undefined ||
      !profile.character_world;

    if (!needsHydration) return;

    (async () => {
      try {
        const res = await fetch(`/api/maple/character?name=${encodeURIComponent(profile.character_name!)}`);
        if (!res.ok) return;
        const latest = await res.json();

        setProfile((prev) => {
          if (!prev) return prev;
          const merged: UserProfile = {
            ...prev,
            character_world: latest.character_world ?? prev.character_world ?? null,
            character_class: latest.character_class ?? prev.character_class,
            character_level: latest.character_level ?? prev.character_level,
            character_exp_rate: latest.character_exp_rate ?? prev.character_exp_rate,
            character_combat_power: latest.character_combat_power ?? prev.character_combat_power ?? null,
            image_url: latest.character_image ?? prev.image_url,
          };
          localStorage.setItem('maple_diary:user_profile', JSON.stringify(merged));
          return merged;
        });
      } catch {
        // ignore profile refresh errors
      }
    })();
  }, [profile?.character_name, profile?.character_combat_power, profile?.character_exp_rate, profile?.character_world]);

  const expRate = useMemo(() => parseExpRate(profile?.character_exp_rate), [profile?.character_exp_rate]);

  return (
    <div className="maple-fade-up">
      <div className="maple-panel rounded-3xl border border-line bg-card/90 p-4 shadow-[var(--shadow-md)]">
        <p className="maple-badge inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold text-amber-600">
          🍁 My Character
        </p>

        {!profile?.character_name ? (
          <div className="mt-4 rounded-2xl border border-dashed border-line-str bg-surface/50 p-4 text-center">
            <p className="text-sm font-semibold text-t2">캐릭터 정보 없음</p>
            <p className="mt-1 text-xs text-t3">온보딩을 완료하면 정보가 표시됩니다</p>
          </div>
        ) : (
          <>
            <div className="mt-4 flex items-center gap-4">
              <div className="relative h-28 w-28 overflow-hidden rounded-2xl border border-line bg-surface">
                {profile.image_url ? (
                  <Image
                    src={profile.image_url}
                    alt={profile.character_name}
                    fill
                    unoptimized
                    className="object-cover scale-[2.4] [image-rendering:pixelated]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl">🍁</div>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-bold text-t1">{profile.character_name}</p>
                <p className="mt-0.5 truncate text-sm text-t2">{profile.character_class || '직업 정보 없음'}</p>
                <p className="mt-1 text-sm font-semibold text-amber-600">Lv. {profile.character_level ?? '-'}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <StatBox label="월드" value={profile.character_world || '-'} />
              <StatBox label="레벨" value={`Lv. ${profile.character_level ?? '-'}`} />
              <StatBox label="직업" value={profile.character_class || '-'} />
              <StatBox label="전투력" value={formatCombatPower(profile.character_combat_power)} />
            </div>

            <div className="mt-3 rounded-2xl border border-line bg-surface/45 p-3">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-semibold text-t2">경험치</span>
                <span className="text-t3">
                  {expRate !== null ? `${expRate.toFixed(3)}%` : '정보 없음'}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-card">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#f59e0b,#ef4444)] transition-all"
                  style={{ width: `${expRate ?? 0}%` }}
                />
              </div>
              {expRate === null && (
                <p className="mt-1.5 text-[11px] text-t3">온보딩 이후 데이터부터 표시됩니다</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface/45 px-2.5 py-2">
      <p className="text-[10px] text-t3">{label}</p>
      <p className="mt-1 truncate text-xs font-semibold text-t1">{value}</p>
    </div>
  );
}
