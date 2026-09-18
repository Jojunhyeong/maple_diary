import nextEnv from '@next/env';
import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { rankingClassFilters, rankingIndexPages, rankingJobIndexPages, selectRankingRows, isUnavailableRankingObservation } from './equipment-guide-plan.mjs';
import { COMBAT_BUCKETS } from '../src/widgets/equipment-guide/model.ts';

nextEnv.loadEnvConfig(process.cwd());
const key = process.env.NEXON_API_KEY || process.env.NEXT_PUBLIC_MAPLE_API_KEY;
if (!key) throw new Error('NEXON_API_KEY가 필요합니다.');
const date = process.env.GUIDE_DATE || new Date(Date.now() - 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
let rankingClasses = rankingClassFilters();
if (process.env.GUIDE_RANKING_CLASSES) {
  const parsedClasses = JSON.parse(process.env.GUIDE_RANKING_CLASSES);
  if (!Array.isArray(parsedClasses) || parsedClasses.some(value => typeof value !== 'string' || !value.trim())) throw new Error('잘못된 랭킹 직업군 목록');
  rankingClasses = [...new Set(parsedClasses.map(value => value.trim()))].sort((a, b) => a.localeCompare(b, 'ko'));
}
const pages = rankingClasses.length ? rankingJobIndexPages(process.env.GUIDE_PAGES) : rankingIndexPages(process.env.GUIDE_PAGES);
const take = Number(process.env.GUIDE_PER_PAGE || (rankingClasses.length ? 50 : 200));
const maxRequests = Number(process.env.GUIDE_MAX_REQUESTS || 25_000);
if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date))) throw new Error('잘못된 기준일');
if (!Number.isInteger(take) || take < 1 || take > 200) throw new Error('잘못된 페이지당 수집 인원');
if (!Number.isSafeInteger(maxRequests) || maxRequests < 1) throw new Error('잘못된 API 요청 한도');

const cacheDirectory = '.cache/equipment-guide-index';
const cachePath = `${cacheDirectory}/${date}.json`;
const progressPath = `${cacheDirectory}/${date}-progress.json`;
const outputPath = process.env.GUIDE_INDEX_OUTPUT || 'src/shared/data/equipment-guide-character-index.json';
await mkdir(cacheDirectory, { recursive: true });
await mkdir('src/shared/data', { recursive: true });

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; return fallback; }
}

const lockPath = `${cacheDirectory}/collector.lock`;
let lock;
try { lock = await open(lockPath, 'wx'); }
catch (error) {
  if (error.code === 'EEXIST') throw new Error('장비 가이드 색인 수집이 이미 실행 중입니다.');
  throw error;
}
await lock.writeFile(String(process.pid));

const cache = await readJson(cachePath, {});
const progress = await readJson(progressPath, { pages: {}, invalidScopes: {} });
progress.invalidScopes ??= {};
let requests = 0;
let lastRequestAt = 0;

async function api(path, params) {
  for (let attempt = 0; attempt < 4; attempt++) {
    if (requests >= maxRequests) throw new Error('설정한 API 요청 한도에 도달했습니다.');
    await new Promise(resolve => setTimeout(resolve, Math.max(0, 220 - (Date.now() - lastRequestAt))));
    lastRequestAt = Date.now();
    requests++;
    const response = await fetch(`https://open.api.nexon.com/maplestory/v1/${path}?${new URLSearchParams(params)}`, {
      headers: { 'x-nxopen-api-key': key }, signal: AbortSignal.timeout(20_000),
    }).catch(() => null);
    if (!response || response.status === 429 || response.status >= 500) {
      await new Promise(resolve => setTimeout(resolve, 1_000 * (attempt + 1)));
      continue;
    }
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const error = new Error(`Nexon ${path}: HTTP ${response.status}`);
      error.status = response.status;
      error.endpoint = path;
      error.code = body?.error?.name;
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
  const entries = Object.values(cache)
    .filter(entry => entry.ocid && entry.job && Number.isFinite(entry.power))
    .sort((a, b) => a.job.localeCompare(b.job, 'ko') || a.power - b.power);
  const index = {
    schemaVersion: 1,
    date,
    collectedAt: new Date().toISOString(),
    sampleCount: entries.length,
    method: rankingClasses.length
      ? '공식 랭킹 직업군별로 상위·중간·심층 페이지를 균형 있게 조회해 전투력 색인을 만들었습니다. 장비는 사용자가 검색한 구간만 별도로 수집합니다.'
      : '종합 랭킹의 상위 및 심층 페이지를 나눠 조회해 직업·전투력 색인을 만들었습니다. 장비는 사용자가 검색한 구간만 별도로 수집합니다.',
    entries,
  };
  if (entries.length >= 100) {
    await writeFile(outputPath + '.tmp', JSON.stringify(index));
    await rename(outputPath + '.tmp', outputPath);
  }
}

try {
  const rankingScopes = rankingClasses.length ? rankingClasses : [null];
  for (const rankingClass of rankingScopes) for (const page of pages) {
    if (rankingClass && progress.invalidScopes[rankingClass]) break;
    const pageKey = `${rankingClass ?? 'all'}:${page}`;
    if (progress.pages[pageKey]?.done) continue;
    const params = { date, page: String(page) };
    if (rankingClass) params.class = rankingClass;
    let ranking;
    try {
      ranking = await api('ranking/overall', params);
    } catch (error) {
      if (rankingClass && error.status === 400 && error.code === 'OPENAPI00004') {
        progress.invalidScopes[rankingClass] = true;
        await save();
        break;
      }
      throw error;
    }
    if (!Array.isArray(ranking.ranking)) throw new Error('랭킹 응답 형식 오류');
    const rows = selectRankingRows(ranking.ranking, take);
    let nextRow = progress.pages[pageKey]?.nextRow || 0;
    for (; nextRow < rows.length; nextRow++) {
      const row = rows[nextRow];
      let completed = true;
      try {
        const id = await api('id', { character_name: row.character_name });
        if (!id.ocid || cache[id.ocid]) continue;
        const stat = await api('character/stat', { ocid: id.ocid, date });
        const power = Number(stat.final_stat?.find(value => value.stat_name === '전투력')?.stat_value);
        const job = stat.character_class;
        if (Number.isFinite(power) && power >= COMBAT_BUCKETS[0].min && power <= COMBAT_BUCKETS.at(-1).max && typeof job === 'string' && job.trim()) {
          cache[id.ocid] = { ocid: id.ocid, job, power };
        }
      } catch (error) {
        if (!isUnavailableRankingObservation(error)) { completed = false; throw error; }
      } finally {
        if (completed) {
          progress.pages[pageKey] = { nextRow: nextRow + 1, done: false };
          if ((nextRow + 1) % 20 === 0) await save();
        }
      }
    }
    progress.pages[pageKey] = { nextRow: rows.length, done: true };
    await save();
    console.log(JSON.stringify({ event: 'page', rankingClass: rankingClass ?? 'all', page, indexed: Object.keys(cache).length, requests }));
  }
} finally {
  try { await save(); }
  finally { await lock.close(); await unlink(lockPath); }
}

console.log(JSON.stringify({ date, rankingClasses: rankingClasses.length || 'all', pages: pages.length, indexed: Object.keys(cache).length, requests }));
