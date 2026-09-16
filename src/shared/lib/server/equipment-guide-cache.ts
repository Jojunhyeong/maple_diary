import { supabaseAdmin } from '@/shared/lib/supabase';
import { aggregateEquipment, itemsHaveFarmingPotential, type EquipmentObservation, type ObservedEquipment } from '@/widgets/equipment-guide/aggregate';
import { COHORT_TARGET_SIZE, COMBAT_BUCKETS, EQUIPMENT_SLOTS, type EquipmentCharacterIndexEntry, type EquipmentGuideDataset } from '@/widgets/equipment-guide/model';
import { EQUIPMENT_GUIDE_BUCKET_SIZE, EQUIPMENT_GUIDE_CACHE_DAYS, EQUIPMENT_GUIDE_MAX_POWER_DISTANCE_RATIO, equipmentGuideCacheKey } from '@/widgets/equipment-guide/cohort';

const CANDIDATE_FETCH_LIMIT = 150;

const ITEM_FIELDS = [
  'item_equipment_slot', 'item_name', 'item_icon', 'starforce',
  'potential_option_grade', 'additional_potential_option_grade',
  'potential_option_1', 'potential_option_2', 'potential_option_3',
  'additional_potential_option_1', 'additional_potential_option_2', 'additional_potential_option_3',
] as const;

type CacheRow = {
  cache_key: string;
  job: string;
  target_power: number;
  source_date: string;
  status: 'collecting' | 'ready' | 'failed';
  dataset: EquipmentGuideDataset | null;
  expires_at: string;
  updated_at: string;
};

export async function equipmentGuideIndexDate() {
  const db = supabaseAdmin();
  const { data, error } = await db.from('equipment_guide_characters').select('source_date').order('source_date', { ascending: false }).limit(1).maybeSingle<{ source_date: string }>();
  return error ? null : data?.source_date ?? null;
}

export async function readEquipmentGuideCache(job: string, power: number, sourceDate: string) {
  const db = supabaseAdmin();
  const cacheKey = equipmentGuideCacheKey(job, power);
  const { data, error } = await db.from('equipment_guide_cache').select('*').eq('cache_key', cacheKey).maybeSingle<CacheRow>();
  if (error) return { cacheKey, row: null, databaseAvailable: false };
  const row = data && data.source_date === sourceDate && Date.parse(data.expires_at) > Date.now() ? data : null;
  return { cacheKey, row, databaseAvailable: true };
}

export async function claimEquipmentGuideCache(cacheKey: string, job: string, power: number, sourceDate: string) {
  const db = supabaseAdmin();
  const { data, error } = await db.rpc('claim_equipment_guide_cache', {
    p_cache_key: cacheKey, p_job: job, p_target_power: power, p_source_date: sourceDate,
  });
  return !error && data === true;
}

async function selectCandidates(job: string, power: number, sourceDate: string) {
  const db = supabaseAdmin();
  const distance = Math.max(EQUIPMENT_GUIDE_BUCKET_SIZE, power * EQUIPMENT_GUIDE_MAX_POWER_DISTANCE_RATIO);
  const fields = 'ocid, job, power';
  const [below, above] = await Promise.all([
    db.from('equipment_guide_characters').select(fields).eq('source_date', sourceDate).eq('job', job).lte('power', power).gte('power', Math.floor(power - distance)).order('power', { ascending: false }).limit(CANDIDATE_FETCH_LIMIT),
    db.from('equipment_guide_characters').select(fields).eq('source_date', sourceDate).eq('job', job).gt('power', power).lte('power', Math.ceil(power + distance)).order('power', { ascending: true }).limit(CANDIDATE_FETCH_LIMIT),
  ]);
  if (below.error || above.error) throw new Error('장비 가이드 색인을 조회하지 못했습니다.');
  return ([...(below.data ?? []), ...(above.data ?? [])] as EquipmentCharacterIndexEntry[])
    .sort((a, b) => Math.abs(a.power - power) - Math.abs(b.power - power))
    .slice(0, CANDIDATE_FETCH_LIMIT);
}

async function nexonEquipment(ocid: string, date: string) {
  const key = process.env.NEXON_API_KEY || process.env.NEXT_PUBLIC_MAPLE_API_KEY;
  if (!key) throw new Error('NEXON_API_KEY가 필요합니다.');
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`https://open.api.nexon.com/maplestory/v1/character/item-equipment?${new URLSearchParams({ ocid, date })}`, {
      headers: { 'x-nxopen-api-key': key }, signal: AbortSignal.timeout(15_000), cache: 'no-store',
    });
    if (response.ok) return response.json() as Promise<Record<string, unknown>>;
    if (response.status !== 429 && response.status < 500) return null;
    await new Promise(resolve => setTimeout(resolve, 1_000 * (attempt + 1)));
  }
  return null;
}

export async function collectAndStoreEquipmentGuide(cacheKey: string, job: string, power: number, sourceDate: string) {
  const observations: EquipmentObservation[] = [];
  try {
    const candidates = await selectCandidates(job, power, sourceDate);
    for (let offset = 0; offset < candidates.length && observations.length < COHORT_TARGET_SIZE; offset += 8) {
      const results = await Promise.all(candidates.slice(offset, offset + 8).map(async candidate => {
        const equipment = await nexonEquipment(candidate.ocid, sourceDate);
        if (!equipment) return null;
        const appliedItems = equipment.item_equipment;
        if (!Array.isArray(appliedItems) || !appliedItems.length || itemsHaveFarmingPotential(appliedItems as ObservedEquipment[])) return null;
        const items = (appliedItems as ObservedEquipment[]).map(item => Object.fromEntries(ITEM_FIELDS.map(field => [field, item[field] ?? null])));
        return { ...candidate, date: sourceDate, items } satisfies EquipmentObservation;
      }));
      for (const observation of results) if (observation) observations.push(observation);
    }
    const sample = observations.slice(0, COHORT_TARGET_SIZE);
    const stats = aggregateEquipment(sample, EQUIPMENT_SLOTS, { targets: [power], size: COHORT_TARGET_SIZE, minPower: COMBAT_BUCKETS[0].min, maxPower: COMBAT_BUCKETS.at(-1)!.max });
    const dataset: EquipmentGuideDataset = {
      source: 'api', stats, cacheStatus: stats.length ? 'ready' : 'unavailable',
      cohort: sample.length ? { targetPower: power, powerMin: Math.min(...sample.map(row => row.power)), powerMax: Math.max(...sample.map(row => row.power)), characterCount: sample.length } : undefined,
    };
    const db = supabaseAdmin();
    await db.from('equipment_guide_cache').update({ status: 'ready', dataset, source_date: sourceDate, expires_at: new Date(Date.now() + EQUIPMENT_GUIDE_CACHE_DAYS * 86_400_000).toISOString(), updated_at: new Date().toISOString() }).eq('cache_key', cacheKey);
  } catch (error) {
    console.error('equipment guide collection failed', error instanceof Error ? error.message : 'unknown error');
    const db = supabaseAdmin();
    await db.from('equipment_guide_cache').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('cache_key', cacheKey);
  }
}
