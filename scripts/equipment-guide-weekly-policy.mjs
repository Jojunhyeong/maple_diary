export function validateWeeklySnapshot(previous, next, expectedDate) {
  if (next.date !== expectedDate || next.source !== 'api') throw new Error('이번 기준일의 API 수집 결과가 아닙니다.');
  if (!Array.isArray(next.stats) || !next.stats.length || !Number.isSafeInteger(next.sampleCount)) throw new Error('통계 형식이 잘못되었습니다.');
  // These are operational regression guards, not statistical confidence thresholds.
  const minimum = Math.max(100, Math.ceil((previous?.sampleCount || 0) * 0.5));
  if (next.sampleCount < minimum) throw new Error(`유효 표본 부족: ${next.sampleCount}명 / 최소 ${minimum}명`);
  if (previous?.date > next.date) throw new Error('현재 공개된 데이터보다 오래된 결과입니다.');
  if (previous?.date === next.date && next.sampleCount < previous.sampleCount) throw new Error('동일 기준일의 더 큰 표본을 유지합니다.');
  const groups = stats => new Set(stats.map(row => `${row.job}:${row.combatPowerBucket}`));
  const previousGroups = groups(previous?.stats || []);
  const nextGroups = groups(next.stats);
  const retained = [...previousGroups].filter(group => nextGroups.has(group)).length;
  if (retained < Math.ceil(previousGroups.size * 0.5)) throw new Error('기존 직업·전투력 구간의 절반 이상이 누락되었습니다.');
  for (const stat of next.stats) {
    if (stat.updatedAt !== expectedDate || !Number.isSafeInteger(stat.sampleCount) || stat.sampleCount < 1 || !stat.items?.length) throw new Error('구간별 통계 검증 실패');
    if (stat.items.reduce((sum, item) => sum + item.count, 0) !== stat.sampleCount) throw new Error('부위별 표본 수가 일치하지 않습니다.');
  }
  return { date: next.date, sampleCount: next.sampleCount, groups: nextGroups.size };
}
