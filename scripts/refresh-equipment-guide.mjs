import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { validateWeeklySnapshot } from './equipment-guide-weekly-policy.mjs';

const date = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
const output = 'src/shared/data/equipment-guide-snapshot.json';
const candidate = `.cache/equipment-guide/${date}-weekly-candidate.json`;
const previous = JSON.parse(await readFile(output, 'utf8'));
await mkdir('.cache/equipment-guide', { recursive: true });

// Keep failed/partial collection separate from the deployed snapshot.
const child = spawn(process.execPath, ['--experimental-strip-types', 'scripts/collect-equipment-guide.mjs'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    GUIDE_DATE: date,
    GUIDE_OUTPUT: candidate,
    GUIDE_MAX_REQUESTS: process.env.GUIDE_MAX_REQUESTS || '25000',
    GUIDE_MAX_DURATION_MS: '9000000', // Save and stop after 150 minutes, before the CI timeout.
  },
});
const exitCode = await new Promise((resolve, reject) => {
  child.on('error', reject);
  child.on('exit', code => resolve(code));
});
if (exitCode !== 0) throw new Error('주간 수집 실패: 기존 공개 통계를 유지합니다.');
const next = JSON.parse(await readFile(candidate, 'utf8'));
const summary = validateWeeklySnapshot(previous, next, date);
// Recheck the current file in case another publisher changed it while collecting.
validateWeeklySnapshot(JSON.parse(await readFile(output, 'utf8')), next, date);
await writeFile(output + '.tmp', JSON.stringify(next));
await rename(output + '.tmp', output);
if (process.env.GITHUB_STEP_SUMMARY) {
  await writeFile(process.env.GITHUB_STEP_SUMMARY, `## 장비 통계 갱신\n\n- 기준일: ${summary.date}\n- 유효 표본: ${summary.sampleCount}명\n- 직업·전투력 구간: ${summary.groups}개\n`, { flag: 'a' });
}
console.log(JSON.stringify({ event: 'weekly-refresh-validated', ...summary }));
