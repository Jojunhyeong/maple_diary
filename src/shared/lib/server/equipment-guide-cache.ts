import { supabaseAdmin } from '@/shared/lib/supabase';
import { aggregateEquipment, itemsHaveFarmingPotential, type EquipmentObservation, type ObservedEquipment } from '@/widgets/equipment-guide/aggregate';
import { COHORT_TARGET_SIZE, COMBAT_BUCKETS, EQUIPMENT_SLOTS, MIN_SAMPLE_COUNT, type EquipmentCharacterIndexEntry, type EquipmentGuideDataset } from '@/widgets/equipment-guide/model';
import { EQUIPMENT_GUIDE_CACHE_DAYS, equipmentGuideCacheKey, isWithinEquipmentGuidePowerRange } from '@/widgets/equipment-guide/cohort';
import { normalizeEquipmentSetEffects, selectRepresentativeCandidates } from '@/widgets/equipment-guide/loadouts';

const CANDIDATE_FETCH_LIMIT = 90;
const SET_EFFECT_CANDIDATE_LIMIT = 20;
const CANDIDATE_BATCH_SIZE = 15;
const SET_EFFECT_BATCH_SIZE = 10;
const LOADOUT_LIMIT = 5;

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
  const fields = 'ocid, job, power';
  const [below, above] = await Promise.all([
    db.from('equipment_guide_characters').select(fields).eq('source_date', sourceDate).eq('job', job).lte('power', power).order('power', { ascending: false }).limit(CANDIDATE_FETCH_LIMIT),
    db.from('equipment_guide_characters').select(fields).eq('source_date', sourceDate).eq('job', job).gt('power', power).order('power', { ascending: true }).limit(CANDIDATE_FETCH_LIMIT),
  ]);
  if (below.error || above.error) throw new Error('장비 가이드 색인을 조회하지 못했습니다.');
  return ([...(below.data ?? []), ...(above.data ?? [])] as EquipmentCharacterIndexEntry[])
    .sort((a, b) => Math.abs(a.power - power) - Math.abs(b.power - power))
    .slice(0, CANDIDATE_FETCH_LIMIT);
}

async function nexonCharacter(path: 'stat' | 'item-equipment' | 'set-effect', ocid: string) {
  const key = process.env.NEXON_API_KEY || process.env.NEXT_PUBLIC_MAPLE_API_KEY;
  if (!key) throw new Error('NEXON_API_KEY가 필요합니다.');
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`https://open.api.nexon.com/maplestory/v1/character/${path}?${new URLSearchParams({ ocid })}`, {
      headers: { 'x-nxopen-api-key': key }, signal: AbortSignal.timeout(15_000), cache: 'no-store',
    });
    if (response.ok) return response.json() as Promise<Record<string, unknown>>;
    if (response.status !== 429 && response.status < 500) return null;
    await new Promise(resolve => setTimeout(resolve, 1_000 * (attempt + 1)));
  }
  return null;
}

async function representativeLoadouts(sample: EquipmentObservation[], targetPower: number) {
  const enriched = [];
  const candidates = sample.slice(0, SET_EFFECT_CANDIDATE_LIMIT);
  for (let offset = 0; offset < candidates.length; offset += SET_EFFECT_BATCH_SIZE) {
    const rows = await Promise.all(candidates.slice(offset, offset + SET_EFFECT_BATCH_SIZE).map(async observation => {
      const payload = await nexonCharacter('set-effect', observation.ocid).catch(() => null);
      const setEffects = payload ? normalizeEquipmentSetEffects(payload) : [];
      const itemSignature = observation.items.map(item => `${item.item_equipment_slot}:${item.item_name}`).sort().join('|');
      return { ...observation, setEffects, itemSignature };
    }));
    enriched.push(...rows);
  }
  return selectRepresentativeCandidates(enriched, targetPower, LOADOUT_LIMIT).map((observation, index) => ({
    id: `representative-${index + 1}`,
    power: observation.power,
    date: observation.date,
    setEffects: observation.setEffects,
    items: EQUIPMENT_SLOTS.flatMap(slot => {
      const item = observation.items.find(row => row.item_equipment_slot === slot.apiSlot);
      if (!item?.item_name) return [];
      const starforce = item.starforce !== null && item.starforce !== undefined && item.starforce !== '' && Number.isFinite(Number(item.starforce)) ? Number(item.starforce) : undefined;
      return [{
        slot: slot.id, itemName: item.item_name, itemIcon: item.item_icon || undefined, starforce,
        potentialGrade: item.potential_option_grade || undefined,
        additionalPotentialGrade: item.additional_potential_option_grade || undefined,
      }];
    }),
  }));
}

export async function collectAndStoreEquipmentGuide(cacheKey: string, job: string, power: number, sourceDate: string) {
  const observations: EquipmentObservation[] = [];
  try {
    const candidates = await selectCandidates(job, power, sourceDate);
    const observationDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
    for (let offset = 0; offset < candidates.length; offset += CANDIDATE_BATCH_SIZE) {
      const results = await Promise.all(candidates.slice(offset, offset + CANDIDATE_BATCH_SIZE).map(async candidate => {
        const [stat, equipment] = await Promise.all([
          nexonCharacter('stat', candidate.ocid),
          nexonCharacter('item-equipment', candidate.ocid),
        ]);
        if (!stat || !equipment || stat.character_class !== job) return null;
        const currentPower = Number((stat.final_stat as Array<{ stat_name?: string; stat_value?: string }> | undefined)?.find(value => value.stat_name === '전투력')?.stat_value);
        if (!Number.isFinite(currentPower) || currentPower <= 0) return null;
        const appliedItems = equipment.item_equipment;
        if (!Array.isArray(appliedItems) || !appliedItems.length || itemsHaveFarmingPotential(appliedItems as ObservedEquipment[])) return null;
        const items = (appliedItems as ObservedEquipment[]).map(item => Object.fromEntries(ITEM_FIELDS.map(field => [field, item[field] ?? null])));
        return { ...candidate, power: currentPower, date: observationDate, items } satisfies EquipmentObservation;
      }));
      for (const observation of results) {
        if (observation && isWithinEquipmentGuidePowerRange(observation.power, power)) observations.push(observation);
      }
      if (observations.length >= COHORT_TARGET_SIZE) break;
    }
    const sample = observations
      .sort((a, b) => Math.abs(a.power - power) - Math.abs(b.power - power) || a.power - b.power)
      .slice(0, COHORT_TARGET_SIZE);
    const enoughSamples = sample.length >= MIN_SAMPLE_COUNT;
    const stats = enoughSamples
      ? aggregateEquipment(sample, EQUIPMENT_SLOTS, { targets: [power], size: COHORT_TARGET_SIZE, minPower: COMBAT_BUCKETS[0].min, maxPower: COMBAT_BUCKETS.at(-1)!.max })
        .filter(stat => stat.sampleCount >= MIN_SAMPLE_COUNT)
      : [];
    const loadouts = enoughSamples ? await representativeLoadouts(sample, power) : [];
    const dataset: EquipmentGuideDataset = {
      source: 'api', stats, loadouts, cacheStatus: enoughSamples && stats.length ? 'ready' : 'unavailable',
      cohort: enoughSamples ? { targetPower: power, powerMin: Math.min(...sample.map(row => row.power)), powerMax: Math.max(...sample.map(row => row.power)), characterCount: sample.length } : undefined,
    };
    const db = supabaseAdmin();
    await db.from('equipment_guide_cache').update({ status: 'ready', dataset, source_date: sourceDate, expires_at: new Date(Date.now() + EQUIPMENT_GUIDE_CACHE_DAYS * 86_400_000).toISOString(), updated_at: new Date().toISOString() }).eq('cache_key', cacheKey);
  } catch (error) {
    console.error('equipment guide collection failed', error instanceof Error ? error.message : 'unknown error');
    const db = supabaseAdmin();
    await db.from('equipment_guide_cache').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('cache_key', cacheKey);
  }
}
