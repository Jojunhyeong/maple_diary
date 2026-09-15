import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { validateEquipmentGuideIndex } from './equipment-guide-index-policy.mjs';

const date = new Date(Date.now() - 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
const candidate = `.cache/equipment-guide-index/${date}-candidate.json`;
nextEnv.loadEnvConfig(process.cwd());
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase 서버 환경 변수가 필요합니다.');
const db = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
await mkdir('.cache/equipment-guide-index', { recursive: true });

const child = spawn(process.execPath, ['--experimental-strip-types', 'scripts/collect-equipment-guide-index.mjs'], {
  stdio: 'inherit',
  env: { ...process.env, GUIDE_DATE: date, GUIDE_INDEX_OUTPUT: candidate, GUIDE_MAX_REQUESTS: process.env.GUIDE_MAX_REQUESTS || '25000' },
});
const exitCode = await new Promise((resolve, reject) => {
  child.on('error', reject);
  child.on('exit', code => resolve(code));
});
if (exitCode !== 0) throw new Error('주간 색인 수집 실패: 기존 공개 색인을 유지합니다.');
const next = JSON.parse(await readFile(candidate, 'utf8'));
const { data: latest } = await db.from('equipment_guide_characters').select('source_date').order('source_date', { ascending: false }).limit(1).maybeSingle();
let previous = null;
if (latest?.source_date) {
  const { count } = await db.from('equipment_guide_characters').select('ocid', { count: 'exact', head: true }).eq('source_date', latest.source_date);
  previous = { sampleCount: count ?? 0 };
}
const summary = validateEquipmentGuideIndex(next, date, previous);
for (let offset = 0; offset < next.entries.length; offset += 500) {
  const rows = next.entries.slice(offset, offset + 500).map(entry => ({ ...entry, source_date: date }));
  const { error } = await db.from('equipment_guide_characters').upsert(rows, { onConflict: 'source_date,ocid' });
  if (error) throw error;
}
const { error: cleanupError } = await db.from('equipment_guide_characters').delete().neq('source_date', date);
if (cleanupError) throw cleanupError;
if (process.env.GITHUB_STEP_SUMMARY) {
  await writeFile(process.env.GITHUB_STEP_SUMMARY, `## 장비 검색 색인 갱신\n\n- 기준일: ${summary.date}\n- 캐릭터: ${summary.sampleCount}명\n- 직업: ${summary.jobs}개\n`, { flag: 'a' });
}
console.log(JSON.stringify({ event: 'weekly-index-validated', ...summary }));
