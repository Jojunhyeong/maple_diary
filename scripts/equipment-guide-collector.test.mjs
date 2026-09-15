import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';

const exec = promisify(execFile);
const collector = fileURLToPath(new URL('./collect-equipment-guide.mjs', import.meta.url));

test('interrupted rows resume, completed pages make no requests, and locks are released', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'equipment-collection-test-'));
  try {
    const mock = join(cwd, 'mock.mjs');
    await writeFile(mock, `
      globalThis.fetch = async input => {
        const url = new URL(input);
        const query = url.searchParams;
        let body;
        if (url.pathname.endsWith('/ranking/overall')) {
          if (query.has('class')) throw new Error('Must not restrict collection to preset jobs');
          body = { ranking: ['아델', '아크', '패스파인더', '렌', '비숍'].flatMap(job => [1, 2].map(i => ({ character_name: job + ':' + i }))) };
        } else if (url.pathname.endsWith('/id')) body = { ocid: query.get('character_name') };
        else if (url.pathname.endsWith('/character/stat')) body = { character_class: query.get('ocid').split(':')[0], final_stat: [{ stat_name: '전투력', stat_value: '100000000' }] };
        else if (url.pathname.endsWith('/character/item-equipment')) body = { item_equipment: [{ item_equipment_slot: '모자', item_name: '테스트 모자', starforce: '17' }] };
        else throw new Error('Unexpected endpoint');
        return new Response(JSON.stringify(body), { status: 200 });
      };
    `);
    const env = { ...process.env, NEXON_API_KEY: 'test', GUIDE_DATE: '2026-09-10', GUIDE_PAGES: '1', GUIDE_PER_PAGE: '200' };
    const run = limit => exec(process.execPath, ['--experimental-strip-types', '--import', mock, collector], { cwd, env: { ...env, GUIDE_MAX_REQUESTS: String(limit) } });
    await run(3);
    const partial = JSON.parse(await readFile(join(cwd, '.cache/equipment-guide/2026-09-10-progress-all-jobs-200.json'), 'utf8'));
    assert.equal(partial.pages['all:1'], undefined);
    await run(100);
    const snapshot = JSON.parse(await readFile(join(cwd, 'src/shared/data/equipment-guide-snapshot.json'), 'utf8'));
    assert.equal(snapshot.sampleCount, 10);
    assert.equal(snapshot.stats.length, 140);
    assert.ok(snapshot.stats.some(stat => stat.job === '아델'));
    assert.ok(snapshot.stats.some(stat => stat.job === '렌'));
    const result = await run(100);
    assert.match(result.stdout, /"requests":0/);
    await assert.rejects(readFile(join(cwd, '.cache/equipment-guide/collector.lock')), { code: 'ENOENT' });
    const coverage = JSON.parse(await readFile(join(cwd, '.cache/equipment-guide/2026-09-10-coverage.json'), 'utf8'));
    assert.equal(coverage.groups.length, 135);
    assert.equal(coverage.groups.reduce((sum, row) => sum + row.sampleCount, 0), 10);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
