import { after, type NextRequest } from 'next/server';
import { auth } from '@/../auth';
import snapshot from '@/shared/data/equipment-guide-snapshot.json';
import { supabaseAdmin } from '@/shared/lib/supabase';
import { isUuidLike } from '@/shared/lib/character-storage';
import { EQUIPMENT_GUIDE_ENABLED } from '@/shared/lib/equipment-guide-feature';
import { COMBAT_BUCKETS, MIN_SAMPLE_COUNT, type EquipmentGuideStat } from '@/widgets/equipment-guide/model';
import {
  claimEquipmentGuideCache,
  collectAndStoreEquipmentGuide,
  equipmentGuideIndexDate,
  readEquipmentGuideCache,
} from '@/shared/lib/server/equipment-guide-cache';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type LegacyEquipmentGuideStat = Omit<EquipmentGuideStat, 'cohortPower' | 'powerMin' | 'powerMax'> & { combatPowerBucket: string };

function fallbackDataset(job: string, targetPower: number) {
  const date = snapshot.date as string | null;
  const stale = !date || Date.now() - Date.parse(date + 'T00:00:00+09:00') >= 30 * 86_400_000;
  const allStats = stale ? [] : (snapshot.stats as unknown as Array<EquipmentGuideStat | LegacyEquipmentGuideStat>)
    .filter(stat => stat.sampleCount >= MIN_SAMPLE_COUNT);
  const jobStats = allStats.filter((stat): stat is EquipmentGuideStat => stat.job === job && 'cohortPower' in stat && Number.isFinite(stat.cohortPower));
  const cohortPower = jobStats.reduce<number | undefined>((nearest, stat) => nearest === undefined || Math.abs(stat.cohortPower - targetPower) < Math.abs(nearest - targetPower) ? stat.cohortPower : nearest, undefined);
  let stats: Array<EquipmentGuideStat | LegacyEquipmentGuideStat> = cohortPower === undefined ? [] : jobStats.filter(stat => stat.cohortPower === cohortPower);
  let powerMin = stats[0] && 'powerMin' in stats[0] ? stats[0].powerMin : undefined;
  let powerMax = stats[0] && 'powerMax' in stats[0] ? stats[0].powerMax : undefined;
  if (!stats.length) {
    const bucket = COMBAT_BUCKETS.find((value, index) => targetPower >= value.min && (targetPower < value.max || (index === COMBAT_BUCKETS.length - 1 && targetPower === value.max)));
    stats = bucket ? allStats.filter((stat): stat is LegacyEquipmentGuideStat => stat.job === job && 'combatPowerBucket' in stat && stat.combatPowerBucket === bucket.id) : [];
    powerMin = bucket?.min;
    powerMax = bucket?.max;
  }
  const cohort = stats.length && powerMin !== undefined && powerMax !== undefined
    ? { targetPower, powerMin, powerMax, characterCount: Math.max(...stats.map(stat => stat.sampleCount)) }
    : undefined;
  return { source: 'api' as const, stats, cohort, date, stale, method: snapshot.method, cacheStatus: 'fallback' as const };
}

export async function GET(request: NextRequest) {
  if (!EQUIPMENT_GUIDE_ENABLED) return Response.json({ error: 'Not Found' }, { status: 404 });
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const characterId = request.nextUrl.searchParams.get('characterId');
  const db = supabaseAdmin();
  let characterQuery = db.from('characters').select('class, character_combat_power').eq('user_id', session.user.id);
  if (isUuidLike(characterId)) characterQuery = characterQuery.eq('id', characterId);
  const { data: character, error: characterError } = await characterQuery
    .order('is_active', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ class: string; character_combat_power: number | null }>();
  if (characterError) return Response.json({ error: '등록 캐릭터를 확인하지 못했어요.' }, { status: 500 });
  const job = character?.class?.trim() ?? '';
  const apiPower = Number(character?.character_combat_power);
  const overridePower = Number(request.nextUrl.searchParams.get('power'));
  const requestedPower = Number.isFinite(overridePower) && overridePower > 0 ? overridePower : apiPower;
  if (!job || job.length > 40 || !Number.isFinite(requestedPower) || requestedPower < COMBAT_BUCKETS[0].min || requestedPower > COMBAT_BUCKETS.at(-1)!.max) {
    return Response.json({ error: '등록 캐릭터의 직업과 전투력을 확인해 주세요.' }, { status: 400 });
  }

  const targetPower = requestedPower;
  const sourceDate = await equipmentGuideIndexDate();
  if (!sourceDate) return Response.json(fallbackDataset(job, requestedPower));
  const cached = await readEquipmentGuideCache(job, targetPower, sourceDate);
  if (!cached.databaseAvailable) return Response.json(fallbackDataset(job, requestedPower));
  if (cached.row?.status === 'ready' && cached.row.dataset) {
    return Response.json({ ...cached.row.dataset, date: cached.row.source_date, cacheStatus: 'ready' }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }
  if (cached.row?.status === 'collecting' && Date.now() - Date.parse(cached.row.updated_at) < 600_000) {
    return Response.json({ source: 'api', stats: [], date: sourceDate, cacheStatus: 'collecting', retryAfterMs: 5_000 }, { status: 202 });
  }

  const claimed = await claimEquipmentGuideCache(cached.cacheKey, job, targetPower, sourceDate);
  if (!claimed) {
    return Response.json({ source: 'api', stats: [], date: sourceDate, cacheStatus: 'collecting', retryAfterMs: 5_000 }, { status: 202 });
  }
  after(() => collectAndStoreEquipmentGuide(cached.cacheKey, job, targetPower, sourceDate));
  return Response.json({ source: 'api', stats: [], date: sourceDate, cacheStatus: 'collecting', retryAfterMs: 5_000 }, { status: 202 });
}
