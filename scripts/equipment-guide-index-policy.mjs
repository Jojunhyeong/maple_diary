export function validateEquipmentGuideIndex(index, expectedDate, previous) {
  if (index?.schemaVersion !== 1 || index.date !== expectedDate || !Array.isArray(index.entries)) throw new Error('색인 형식 또는 기준일이 잘못되었습니다.');
  if (index.sampleCount !== index.entries.length || index.sampleCount < 100) throw new Error('색인 표본 수가 부족하거나 일치하지 않습니다.');
  const ids = new Set();
  const jobs = new Set();
  for (const entry of index.entries) {
    if (typeof entry.ocid !== 'string' || !entry.ocid || typeof entry.job !== 'string' || !entry.job || !Number.isFinite(entry.power) || entry.power < 50_000_000 || entry.power > 1_400_000_000) throw new Error('잘못된 색인 항목이 있습니다.');
    if (ids.has(entry.ocid)) throw new Error('중복 OCID가 있습니다.');
    ids.add(entry.ocid);
    jobs.add(entry.job);
  }
  if (jobs.size < 30) throw new Error('색인 직업 수가 부족합니다.');
  if (previous?.sampleCount && index.sampleCount < Math.max(100, Math.floor(previous.sampleCount * 0.5))) throw new Error('이전 색인 대비 표본이 급감했습니다.');
  return { date: index.date, sampleCount: index.sampleCount, jobs: jobs.size };
}
