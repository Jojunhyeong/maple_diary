import nextEnv from '@next/env';
import { rankingPages, selectRankingRows, canPublish, isUnavailableCharacter } from './equipment-guide-plan.mjs';
import { mkdir, readFile, writeFile, rename, open, unlink } from 'node:fs/promises';
import { COMBAT_BUCKETS, EQUIPMENT_SLOTS } from '../src/widgets/equipment-guide/model.ts';
import { aggregateEquipment, hasFarmingPotential } from '../src/widgets/equipment-guide/aggregate.ts';

nextEnv.loadEnvConfig(process.cwd());
const key = process.env.NEXON_API_KEY || process.env.NEXT_PUBLIC_MAPLE_API_KEY;
if (!key) throw new Error('NEXON_API_KEY가 필요합니다.');
const date = process.env.GUIDE_DATE || new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date))) throw new Error('잘못된 기준일');
const pages = rankingPages(process.env.GUIDE_PAGES);
const take = Number(process.env.GUIDE_PER_PAGE || 200);
if (!Number.isInteger(take) || take < 1 || take > 200) throw new Error('잘못된 수집 범위');
// No class filter: collect every job returned by the overall ranking.
const rankings = ['all'];
const maxRequests = Number(process.env.GUIDE_MAX_REQUESTS || Infinity);
if (!(maxRequests > 0) || (Number.isFinite(maxRequests) && !Number.isSafeInteger(maxRequests))) throw new Error('잘못된 API 요청 한도');
const maxDurationMs = Number(process.env.GUIDE_MAX_DURATION_MS || Infinity);
if (!(maxDurationMs > 0)) throw new Error('잘못된 수집 시간 한도');
const startedAt = Date.now();
const cachePath = `.cache/equipment-guide/${date}.json`;
await mkdir('.cache/equipment-guide', { recursive: true });
await mkdir('src/shared/data', { recursive: true });
// A shared lock protects the public snapshot as well as date-specific checkpoints.
const lockPath = '.cache/equipment-guide/collector.lock';
let lock;
try { lock = await open(lockPath, 'wx'); }
catch (error) {
  if (error.code === 'EEXIST') throw new Error('수집 잠금이 있습니다. 실행 중인 수집기를 확인하세요: ' + lockPath);
  throw error;
}
await lock.writeFile(String(process.pid));
async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; return fallback; }
}
let cache;
let progress;
try {
  cache = await readJson(cachePath, {});
  progress = await readJson(`.cache/equipment-guide/${date}-progress-all-jobs-${take}.json`, { pages: {}, ends: {} });
} catch (error) {
  await lock.close(); await unlink(lockPath); throw error;
}
const progressPath = `.cache/equipment-guide/${date}-progress-all-jobs-${take}.json`;
let stopping = false;
process.on('SIGINT', () => { stopping = true; });
process.on('SIGTERM', () => { stopping = true; });
let requests = 0;
let lastStart = 0;
async function api(path, params) {
  for (let attempt = 0; attempt < 4; attempt++) {
    if (stopping || requests >= maxRequests || Date.now() - startedAt >= maxDurationMs) { const error = new Error(stopping ? '중단 요청' : '설정한 API 요청·시간 한도 도달'); error.code = 'COLLECTION_STOP'; throw error; }
    await new Promise(resolve => setTimeout(resolve, Math.max(0, 220 - (Date.now() - lastStart))));
    lastStart = Date.now(); requests++;
    let response;
    try {
      response = await fetch(`https://open.api.nexon.com/maplestory/v1/${path}?${new URLSearchParams(params)}`, { headers: { 'x-nxopen-api-key': key }, signal: AbortSignal.timeout(20000) });
    } catch (error) {
      if (attempt === 3) throw error;
      await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
      continue;
    }
    if (response.status === 429 || response.status >= 500) { await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1))); continue; }
    if (!response.ok) {
      const error = new Error(`Nexon ${path}: HTTP ${response.status}`);
      error.status = response.status;
      error.endpoint = path;
      const body = await response.json().catch(() => null);
      error.code = body?.error?.name; // Only the code is retained; never log identifiers or the API key.
      throw error;
    }
    return response.json();
  }
  throw new Error('Nexon 요청 재시도 한도 초과');
}
async function save() {
  await writeFile(cachePath + '.tmp', JSON.stringify(cache));
  await rename(cachePath + '.tmp', cachePath);
  await writeFile(progressPath + '.tmp', JSON.stringify(progress));
  await rename(progressPath + '.tmp', progressPath);
  const observations = Object.values(cache).filter(row => row.items?.length);
  const eligible = observations.filter(observation => !hasFarmingPotential(observation));
  const stats = aggregateEquipment(observations, EQUIPMENT_SLOTS, COMBAT_BUCKETS);
  const observedJobs = [...new Set(observations.map(row => row.job))].sort();
  const coverage = observedJobs.flatMap(job => COMBAT_BUCKETS.map((bucket, index) => ({
    job,
    bucket: bucket.id,
    label: bucket.label,
    sampleCount: eligible.filter(row => row.job === job && row.power >= bucket.min && (row.power < bucket.max || (index === COMBAT_BUCKETS.length - 1 && row.power === bucket.max))).length,
  })));
  const coveragePath = `.cache/equipment-guide/${date}-coverage.json`;
  await writeFile(coveragePath + '.tmp', JSON.stringify({ date, updatedAt: new Date().toISOString(), below30: coverage.filter(row => row.sampleCount < 30).length, groups: coverage }, null, 2));
  await rename(coveragePath + '.tmp', coveragePath);
  const snapshot = { source: 'api', collectedAt: new Date().toISOString(), date, sampleCount: eligible.length, excludedFarmingPresetCount: observations.length - eligible.length, scannedCount: Object.keys(cache).length, method: '전체 직업 종합 랭킹에서 수집했으며 아이템 드롭률·메소 획득량 잠재 장착 캐릭터를 제외한 표본입니다. 전체 유저 통계가 아닙니다.', stats };
  // Never replace the published snapshot with a failed/empty collection.
  const output = process.env.GUIDE_OUTPUT || 'src/shared/data/equipment-guide-snapshot.json';
  const published = canPublish(await readJson(output, null), snapshot);
  if (published) {
    await writeFile(output + '.tmp', JSON.stringify(snapshot));
    await rename(output + '.tmp', output);
  }
  console.log(JSON.stringify({ date, scanned: snapshot.scannedCount, collected: observations.length, eligible: eligible.length, excludedFarmingPresets: snapshot.excludedFarmingPresetCount, groups: new Set(stats.map(s => `${s.job}:${s.combatPowerBucket}`)).size, requests, published }));
}
try {
  if (!process.argv.includes('--aggregate-only')) for (const page of pages) {
    if (rankings.every(rankingKey => progress.ends[rankingKey] && page >= progress.ends[rankingKey])) {
      // Anchors may be beyond the end; smaller unvisited pages must still run.
      if (page > 200) break;
      continue;
    }
    for (const rankingKey of rankings) {
    if (progress.ends[rankingKey] && page >= progress.ends[rankingKey]) continue;
    const pageKey = `${rankingKey}:${page}`;
    if (progress.pages[pageKey]?.done) continue;
    const ranking = await api('ranking/overall', { date, page: String(page) });
    if (!Array.isArray(ranking.ranking)) throw new Error('랭킹 응답 형식 오류');
    if (!ranking.ranking.length) {
      progress.ends[rankingKey] = Math.min(progress.ends[rankingKey] || Infinity, page);
      await save(); continue;
    }
    const rows = selectRankingRows(ranking.ranking, take);
    console.log(JSON.stringify({ event: 'page', ranking: rankingKey, page, rows: rows.length }));
    let nextRow = progress.pages[pageKey]?.nextRow || 0;
    for (; nextRow < rows.length; nextRow++) {
      const row = rows[nextRow];
      let completed = true;
      try {
      const id = await api('id', { character_name: row.character_name });
      if (!id.ocid) continue;
      if (cache[id.ocid]) continue;
      const stat = await api('character/stat', { ocid: id.ocid, date });
      const rawPower = stat.final_stat?.find(value => value.stat_name === '전투력')?.stat_value;
      const power = Number(rawPower);
      if (!rawPower || !Number.isFinite(power)) continue;
      const job = stat.character_class;
      if (typeof job !== 'string' || !job.trim()) throw new Error('직업 응답 형식 오류');
      if (power < COMBAT_BUCKETS[0].min || power > COMBAT_BUCKETS.at(-1).max) { cache[id.ocid] = { ocid: id.ocid, job, power, date, items: [] }; continue; }
      const equipment = await api('character/item-equipment', { ocid: id.ocid, date });
      if (!Array.isArray(equipment.item_equipment) || !equipment.item_equipment.length) continue;
      const fields = ['item_equipment_slot', 'item_name', 'item_icon', 'starforce', 'potential_option_grade', 'additional_potential_option_grade', ...[1, 2, 3].flatMap(i => [`potential_option_${i}`, `additional_potential_option_${i}`])];
      cache[id.ocid] = { ocid: id.ocid, job, power, date, items: equipment.item_equipment.map(item => Object.fromEntries(fields.map(field => [field, item[field] ?? null]))) };
      } catch (error) {
        // Deleted characters and unavailable historical observations are not samples.
        if (isUnavailableCharacter(error)) { console.log('기준일 조회 불가 캐릭터 제외'); continue; }
        completed = false;
        throw error;
      } finally {
        if (completed) {
          progress.pages[pageKey] = { nextRow: nextRow + 1, done: false };
          if ((nextRow + 1) % 20 === 0) await save();
        }
      }
    }
    progress.pages[pageKey] = { nextRow: rows.length, done: true };
    await save();
    }
  }
} catch (error) {
  console.error(JSON.stringify({ event: 'stopped', reason: error.message, code: error.code, requests }));
  if (error.code !== 'COLLECTION_STOP') process.exitCode = 1;
} finally {
  try { await save(); }
  finally { await lock.close(); await unlink(lockPath); }
}
