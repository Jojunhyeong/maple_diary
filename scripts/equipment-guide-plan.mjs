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

// Sample both the top ranks and deeper rank bands. Deeper pages contain the
// lower-combat-power characters that a sequential top-rank crawl rarely sees.
export function rankingIndexPages(explicitPages) {
  if (explicitPages) return [...rankingPages(explicitPages)];
  const pages = Array.from({ length: 10 }, (_, index) => index + 1);
  const start = Math.log(15);
  const end = Math.log(5_000);
  for (let index = 0; index < 46; index++) {
    pages.push(Math.round(Math.exp(start + (end - start) * index / 45)));
  }
  return [...new Set([...pages, 200, 500, 1_000, 2_000, 5_000])].sort((a, b) => a - b);
}

// A few separated pages per class produce a balanced pool without crawling
// the entire overall ranking. The on-demand search later sorts this pool by
// combat-power distance.
export function rankingJobIndexPages(explicitPages) {
  if (explicitPages) return [...rankingPages(explicitPages)];
  return [1, 20, 200, 1_000];
}

export function rankingClassFilters() {
  return [
    '전사-히어로', '전사-팔라딘', '전사-다크나이트',
    '마법사-아크메이지(불,독)', '마법사-아크메이지(썬,콜)', '마법사-비숍',
    '궁수-보우마스터', '궁수-신궁', '궁수-패스파인더',
    '도적-나이트로드', '도적-섀도어', '도적-듀얼블레이더',
    '해적-바이퍼', '해적-캡틴', '해적-캐논마스터',
    '기사단-소울마스터', '기사단-플레임위자드', '기사단-윈드브레이커', '기사단-나이트워커', '기사단-스트라이커', '기사단-미하일',
    '아란-전체 전직', '에반-전체 전직', '메르세데스-전체 전직', '팬텀-전체 전직', '루미너스-전체 전직', '은월-전체 전직',
    '레지스탕스-배틀메이지', '레지스탕스-와일드헌터', '레지스탕스-메카닉', '레지스탕스-데몬슬레이어', '레지스탕스-데몬어벤져', '레지스탕스-제논', '레지스탕스-블래스터',
    '카이저-전체 전직', '엔젤릭버스터-전체 전직', '초월자-제로', '프렌즈 월드-키네시스',
    '카데나-전체 전직', '일리움-전체 전직', '아크-전체 전직', '호영-전체 전직', '아델-전체 전직', '카인-전체 전직', '라라-전체 전직', '칼리-전체 전직', '렌-전체 전직', '레테-전체 전직',
  ];
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

export function isUnavailableRankingObservation(error) {
  return isUnavailableCharacter(error)
    // A character can remain in the daily ranking while its historical stat
    // record is no longer prepared. Skipping that one row keeps the index run.
    || (error.endpoint === 'character/stat' && error.code === 'OPENAPI00004');
}
