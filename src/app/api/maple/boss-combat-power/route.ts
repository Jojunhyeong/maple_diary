import { auth } from '@/../auth';
import { EQUIPMENT_GUIDE_ENABLED } from '@/shared/lib/equipment-guide-feature';
import { isUuidLike } from '@/shared/lib/character-storage';
import { supabaseAdmin } from '@/shared/lib/supabase';
import { itemsHaveFarmingPotential, type ObservedEquipment } from '@/widgets/equipment-guide/aggregate';

const MAPLE_API_BASE = 'https://open.api.nexon.com/maplestory/v1';
const HISTORY_DAYS = 14;
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;

type BossPowerResult = { combatPower: number; date: string; presetNo: number | null; daysChecked: number };
type CachedBossPower = { expiresAt: number; result: BossPowerResult };

declare global {
  var __mapleBossPowerCache: Map<string, CachedBossPower> | undefined;
}

const bossPowerCache = globalThis.__mapleBossPowerCache ?? (globalThis.__mapleBossPowerCache = new Map());

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function recentKstDates(days: number) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(Date.now() - (index + 1) * 86_400_000);
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(date);
  });
}

function parseCombatPower(finalStat: unknown) {
  if (!Array.isArray(finalStat)) return null;
  const row = finalStat.find(value => value && typeof value === 'object' && String((value as { stat_name?: unknown }).stat_name).includes('전투력'));
  const power = Number(String((row as { stat_value?: unknown } | undefined)?.stat_value ?? '').replace(/[^\d]/g, ''));
  return Number.isFinite(power) && power > 0 ? power : null;
}

async function nexonJson(path: string, params: Record<string, string>, apiKey: string) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(`${MAPLE_API_BASE}/${path}?${new URLSearchParams(params)}`, {
      headers: { 'x-nxopen-api-key': apiKey }, signal: AbortSignal.timeout(12_000), cache: 'no-store',
    });
    if (response.ok) return response.json() as Promise<Record<string, unknown>>;
    if (response.status !== 429 && response.status < 500) return null;
    await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
  }
  return null;
}

async function resolveOcid(characterName: string, apiKey: string) {
  const result = await nexonJson('id', { character_name: characterName }, apiKey);
  return typeof result?.ocid === 'string' ? result.ocid : null;
}

async function findRecentBossPower(ocid: string, apiKey: string): Promise<BossPowerResult | null> {
  const dates = recentKstDates(HISTORY_DAYS);
  const cleanDates: Array<{ date: string; presetNo: number | null }> = [];
  for (let offset = 0; offset < dates.length; offset += 4) {
    const rows = await Promise.all(dates.slice(offset, offset + 4).map(async date => {
      const equipment = await nexonJson('character/item-equipment', { ocid, date }, apiKey);
      const items = equipment?.item_equipment;
      if (!Array.isArray(items) || !items.length || itemsHaveFarmingPotential(items as ObservedEquipment[])) return null;
      const presetNo = Number(equipment?.preset_no);
      return { date, presetNo: Number.isFinite(presetNo) && presetNo > 0 ? presetNo : null };
    }));
    cleanDates.push(...rows.filter((row): row is { date: string; presetNo: number | null } => row !== null));
  }

  const powers: BossPowerResult[] = [];
  for (let offset = 0; offset < cleanDates.length; offset += 4) {
    const rows = await Promise.all(cleanDates.slice(offset, offset + 4).map(async clean => {
      const stat = await nexonJson('character/stat', { ocid, date: clean.date }, apiKey);
      const combatPower = parseCombatPower(stat?.final_stat);
      return combatPower ? { ...clean, combatPower, daysChecked: dates.length } : null;
    }));
    powers.push(...rows.filter((row): row is BossPowerResult => row !== null));
  }
  return powers.sort((a, b) => b.combatPower - a.combatPower || b.date.localeCompare(a.date))[0] ?? null;
}

export async function GET(request: Request) {
  if (!EQUIPMENT_GUIDE_ENABLED) return Response.json({ error: 'Not Found' }, { status: 404 });
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const characterId = new URL(request.url).searchParams.get('characterId');
  if (!isUuidLike(characterId)) return Response.json({ error: '캐릭터를 확인해 주세요.' }, { status: 400 });

  const { data: character, error } = await supabaseAdmin()
    .from('characters')
    .select('character_name, character_ocid')
    .eq('id', characterId)
    .eq('user_id', session.user.id)
    .maybeSingle<{ character_name: string; character_ocid: string | null }>();
  if (error || !character) return Response.json({ error: '등록 캐릭터를 확인하지 못했어요.' }, { status: error ? 500 : 404 });

  const apiKey = process.env.NEXT_PUBLIC_MAPLE_API_KEY;
  if (!apiKey) return Response.json({ error: 'API 키가 설정되지 않았습니다.' }, { status: 500 });
  const ocid = character.character_ocid?.trim() || await resolveOcid(character.character_name, apiKey);
  if (!ocid) return Response.json({ error: '캐릭터 정보를 찾지 못했어요.' }, { status: 404 });

  const cached = bossPowerCache.get(ocid);
  if (cached && cached.expiresAt > Date.now()) return Response.json(cached.result);
  const result = await findRecentBossPower(ocid, apiKey);
  if (!result) return Response.json({ error: `최근 ${HISTORY_DAYS}일에서 드메 잠재가 없는 적용 세팅을 찾지 못했어요.` }, { status: 404 });
  bossPowerCache.set(ocid, { result, expiresAt: Date.now() + CACHE_TTL_MS });
  return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
}
