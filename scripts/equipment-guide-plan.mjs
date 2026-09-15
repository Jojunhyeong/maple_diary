// Visit separated ranking bands first, then fill every gap without a page ceiling.
export function* rankingPages(explicitPages) {
  if (explicitPages) {
    const pages = explicitPages.split(',').map(Number);
    if (pages.some(page => !Number.isSafeInteger(page) || page < 1)) throw new Error('잘못된 랭킹 페이지');
    yield* new Set(pages);
    return;
  }
  const anchors = new Set([1, 5, 15, 40, 100, 200]);
  yield* anchors;
  for (let page = 2; ; page++) if (!anchors.has(page)) yield page;
}

export function selectRankingRows(rows, take) {
  if (!Number.isSafeInteger(take) || take < 1 || take > 200) throw new Error('잘못된 페이지당 수집 인원');
  if (rows.length <= take) return rows;
  return Array.from({ length: take }, (_, index) => rows[Math.floor(index * rows.length / take)]);
}

export function canPublish(previous, next) {
  if (!next.stats.length) return false;
  if (!previous) return true;
  if (previous.date > next.date) return false;
  // Do not replace a larger live dataset with the beginning of a new collection.
  return next.sampleCount >= previous.sampleCount;
}

export function isUnavailableCharacter(error) {
  return error.status === 404
    || error.code === 'OPENAPI00003'
    // A name returned by the official ranking can disappear or become
    // unavailable before its OCID lookup. Only tolerate this code at /id.
    || (error.endpoint === 'id' && error.code === 'OPENAPI00004');
}
