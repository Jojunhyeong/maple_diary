import { NextRequest, NextResponse } from 'next/server';

const MAPLE_API_BASE = 'https://open.api.nexon.com/maplestory/v1';
const EQUIPMENT_CACHE_TTL_MS = 1000 * 60 * 60 * 12;
const RATE_LIMIT_CACHE_TTL_MS = 1000 * 60 * 5;

type CachedEquipment = {
  expiresAt: number;
  status: number;
  payload: Record<string, unknown>;
};

declare global {
  // eslint-disable-next-line no-var
  var __mapleEquipmentCache: Map<string, CachedEquipment> | undefined;
  // eslint-disable-next-line no-var
  var __mapleEquipmentPending: Map<string, Promise<{ status: number; payload: Record<string, unknown> }>> | undefined;
}

const equipmentCache: Map<string, CachedEquipment> =
  globalThis.__mapleEquipmentCache ?? (globalThis.__mapleEquipmentCache = new Map());
const pendingRequests: Map<string, Promise<{ status: number; payload: Record<string, unknown> }>> =
  globalThis.__mapleEquipmentPending ?? (globalThis.__mapleEquipmentPending = new Map());

type EquipmentRow = {
  item_equipment_part?: string;
  item_equipment_slot?: string;
  item_name?: string;
  item_icon?: string;
  item_shape_icon?: string;
  [key: string]: unknown;
};

function normalizeEquipmentRows(rows: EquipmentRow[]) {
  return rows.map((row, index) => ({
    id: `${row.item_equipment_slot ?? row.item_equipment_part ?? 'item'}-${index}`,
    slot: row.item_equipment_slot ?? row.item_equipment_part ?? '기타',
    part: row.item_equipment_part ?? null,
    name: row.item_name ?? 'Unknown',
    icon_url: row.item_icon ?? row.item_shape_icon ?? null,
    shape_icon_url: row.item_shape_icon ?? null,
    raw: row,
  }));
}

function extractPrimaryEquipment(payload: Record<string, unknown>): EquipmentRow[] {
  const primary = payload.item_equipment;
  if (Array.isArray(primary)) return primary as EquipmentRow[];

  const fallbackKeys = Object.keys(payload).filter((key) => key.startsWith('item_equipment_preset_'));
  const fallback: EquipmentRow[] = [];
  for (const key of fallbackKeys) {
    const value = payload[key];
    if (Array.isArray(value)) fallback.push(...(value as EquipmentRow[]));
  }
  return fallback;
}

async function resolveOcid(name: string, apiKey: string): Promise<string> {
  const res = await fetch(
    `${MAPLE_API_BASE}/id?character_name=${encodeURIComponent(name)}`,
    { headers: { 'x-nxopen-api-key': apiKey } },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || '캐릭터를 찾을 수 없습니다');
  }

  const { ocid } = await res.json();
  if (typeof ocid !== 'string' || !ocid) throw new Error('캐릭터를 찾을 수 없습니다');
  return ocid;
}

async function fetchFromNexon(
  input: { ocid?: string | null; name?: string | null },
  cacheKey: string,
  apiKey: string,
): Promise<{ status: number; payload: Record<string, unknown> }> {
  try {
    const ocid = input.ocid || (input.name ? await resolveOcid(input.name, apiKey) : null);
    if (!ocid) {
      return { status: 400, payload: { error: 'ocid 또는 character name이 필요합니다' } };
    }

    const [basicRes, equipmentRes] = await Promise.all([
      fetch(`${MAPLE_API_BASE}/character/basic?ocid=${ocid}`, {
        headers: { 'x-nxopen-api-key': apiKey },
      }),
      fetch(`${MAPLE_API_BASE}/character/item-equipment?ocid=${ocid}`, {
        headers: { 'x-nxopen-api-key': apiKey },
      }),
    ]);

    if (!basicRes.ok) {
      const err = await basicRes.json().catch(() => ({}));
      return {
        status: basicRes.status || 500,
        payload: { error: err.error?.message || '캐릭터 기본 정보를 불러오지 못했습니다' },
      };
    }

    if (!equipmentRes.ok) {
      const status = equipmentRes.status;
      const err = await equipmentRes.json().catch(() => ({}));
      const message =
        status === 429
          ? '장비 정보를 너무 자주 조회했어요. 잠시 후 다시 시도해주세요.'
          : err.error?.message || '장비 정보를 불러오지 못했습니다';
      const payload = { error: message };
      equipmentCache.set(cacheKey, {
        status: status === 429 ? 429 : status || 500,
        payload,
        expiresAt: Date.now() + (status === 429 ? RATE_LIMIT_CACHE_TTL_MS : 1000 * 60),
      });
      return { status: status === 429 ? 429 : status || 500, payload };
    }

    const basic = await basicRes.json();
    const equipment = await equipmentRes.json();
    const items = normalizeEquipmentRows(extractPrimaryEquipment(equipment));

    const payload = {
      ocid,
      character_name: basic.character_name ?? null,
      character_world: basic.world_name ?? null,
      character_class: basic.character_class ?? null,
      character_level: basic.character_level ?? null,
      character_image: basic.character_image ?? null,
      items,
    };

    equipmentCache.set(cacheKey, {
      status: 200,
      payload,
      expiresAt: Date.now() + EQUIPMENT_CACHE_TTL_MS,
    });

    return { status: 200, payload };
  } catch (error) {
    const payload = { error: error instanceof Error ? error.message : '서버 오류가 발생했습니다' };
    equipmentCache.set(cacheKey, {
      status: 500,
      payload,
      expiresAt: Date.now() + 1000 * 60,
    });
    return { status: 500, payload };
  }
}

export async function GET(request: NextRequest) {
  const ocid = request.nextUrl.searchParams.get('ocid');
  const name = request.nextUrl.searchParams.get('name');

  if (!ocid && !name) {
    return NextResponse.json({ error: 'ocid 또는 name이 필요합니다' }, { status: 400 });
  }

  const cacheKey = (ocid || name || '').trim().toLowerCase();
  const cached = equipmentCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.payload, { status: cached.status });
  }

  const apiKey = process.env.NEXT_PUBLIC_MAPLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'API 키가 설정되지 않았습니다' }, { status: 500 });
  }

  const inflight = pendingRequests.get(cacheKey);
  if (inflight) {
    try {
      const { status, payload } = await inflight;
      return NextResponse.json(payload, { status });
    } catch {
      return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 });
    }
  }

  const promise = fetchFromNexon({ ocid, name }, cacheKey, apiKey).finally(() => {
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
