import { NextRequest, NextResponse } from 'next/server';

const MAPLE_API_BASE = 'https://open.api.nexon.com/maplestory/v1';
const CHARACTER_CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const RATE_LIMIT_CACHE_TTL_MS = 1000 * 60 * 5;

type CachedCharacter = {
  expiresAt: number;
  status: number;
  payload: Record<string, unknown>;
};

declare global {
  // eslint-disable-next-line no-var
  var __mapleCharacterCache: Map<string, CachedCharacter> | undefined;
  // eslint-disable-next-line no-var
  var __mapleCharacterPending: Map<string, Promise<{ status: number; payload: Record<string, unknown> }>> | undefined;
}
const characterCache: Map<string, CachedCharacter> =
  globalThis.__mapleCharacterCache ?? (globalThis.__mapleCharacterCache = new Map());
const pendingRequests: Map<string, Promise<{ status: number; payload: Record<string, unknown> }>> =
  globalThis.__mapleCharacterPending ?? (globalThis.__mapleCharacterPending = new Map());

function parseCombatPower(finalStats: unknown): number | null {
  if (!Array.isArray(finalStats)) return null;

  for (const stat of finalStats) {
    if (!stat || typeof stat !== 'object') continue;
    const name = (stat as { stat_name?: unknown }).stat_name;
    const value = (stat as { stat_value?: unknown }).stat_value;

    if (typeof name !== 'string' || typeof value !== 'string') continue;
    if (!name.includes('전투력')) continue;

    const parsed = Number(value.replace(/[^\d]/g, ''));
    if (!Number.isNaN(parsed)) return parsed;
  }

  return null;
}

async function fetchFromNexon(
  name: string,
  cacheKey: string,
  apiKey: string,
): Promise<{ status: number; payload: Record<string, unknown> }> {
  // 1. ocid 조회
  const ocidRes = await fetch(
    `${MAPLE_API_BASE}/id?character_name=${encodeURIComponent(name)}`,
    { headers: { 'x-nxopen-api-key': apiKey } },
  );

  if (!ocidRes.ok) {
    const err = await ocidRes.json().catch(() => ({}));
    const status = ocidRes.status;
    const message =
      status === 429
        ? '캐릭터 정보를 너무 자주 조회했어요. 잠시 후 다시 시도해주세요.'
        : err.error?.message || '캐릭터를 찾을 수 없습니다';
    const payload = { error: message };
    characterCache.set(cacheKey, {
      status: status === 429 ? 429 : status === 404 ? 404 : status || 500,
      payload,
      expiresAt: Date.now() + (status === 429 ? RATE_LIMIT_CACHE_TTL_MS : 1000 * 60),
    });
    return { status: status === 404 ? 404 : status || 500, payload };
  }

  const { ocid } = await ocidRes.json();

  // 2. 기본 정보 + 스탯 조회
  const [basicRes, statRes] = await Promise.all([
    fetch(
      `${MAPLE_API_BASE}/character/basic?ocid=${ocid}`,
      { headers: { 'x-nxopen-api-key': apiKey } },
    ),
    fetch(
      `${MAPLE_API_BASE}/character/stat?ocid=${ocid}`,
      { headers: { 'x-nxopen-api-key': apiKey } },
    ),
  ]);

  if (!basicRes.ok) {
    return { status: 500, payload: { error: '캐릭터 정보 조회 실패' } };
  }

  const basic = await basicRes.json();
  const stat = statRes.ok ? await statRes.json().catch(() => null) : null;
  const combatPower = parseCombatPower(stat?.final_stat);

  const payload = {
    character_name: basic.character_name,
    character_world: basic.world_name ?? null,
    character_class: basic.character_class,
    character_level: basic.character_level,
    character_exp_rate: basic.character_exp_rate ?? null,
    character_combat_power: combatPower,
    character_image: basic.character_image,
    ocid,
  };

  characterCache.set(cacheKey, {
    status: 200,
    payload,
    expiresAt: Date.now() + CHARACTER_CACHE_TTL_MS,
  });

  return { status: 200, payload };
}

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get('name');
  if (!name) {
    return NextResponse.json({ error: '캐릭터 이름이 필요합니다' }, { status: 400 });
  }

  const cacheKey = name.trim().toLowerCase();
  const cached = characterCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.payload, { status: cached.status });
  }

  const apiKey = process.env.NEXT_PUBLIC_MAPLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'API 키가 설정되지 않았습니다' }, { status: 500 });
  }

  // 동일 캐릭터 동시 요청이 있으면 하나의 Nexon 호출만 사용
  const inflight = pendingRequests.get(cacheKey);
  if (inflight) {
    try {
      const { status, payload } = await inflight;
      return NextResponse.json(payload, { status });
    } catch {
      return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 });
    }
  }

  const promise = fetchFromNexon(name, cacheKey, apiKey).finally(() => {
    pendingRequests.delete(cacheKey);
  });
  pendingRequests.set(cacheKey, promise);

  try {
    const { status, payload } = await promise;
    return NextResponse.json(payload, { status });
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}
