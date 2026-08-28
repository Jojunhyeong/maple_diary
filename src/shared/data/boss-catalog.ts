export type BossCategoryKey = 'general' | 'subboss' | 'grandis';
export type BossDifficultyKey = 'easy' | 'normal' | 'hard' | 'extreme';

export type BossCatalogEntry = {
  id: string;
  name: string;
  category: BossCategoryKey;
  difficulties: Partial<Record<BossDifficultyKey, number>>;
  maxPartySize?: number;
  difficultyMaxPartySize?: Partial<Record<BossDifficultyKey, number>>;
  resetCycle?: 'weekly' | 'monthly';
  rewardKind?: 'crystal' | 'fixed';
  accountWide?: boolean;
  seasonal?: boolean;
  dropItems?: Array<{
    id: string;
    name: string;
  }>;
};

export type BossCatalogGroup = {
  key: BossCategoryKey;
  label: string;
  description: string;
  columns: BossDifficultyKey[];
  bosses: BossCatalogEntry[];
};

export const BOSS_CATALOG: BossCatalogGroup[] = [
  {
    key: 'grandis',
    label: '그란디스',
    description: '세렌부터 유피테르까지 그란디스 레이드와 시즌 보스',
    columns: ['easy', 'normal', 'hard', 'extreme'],
    bosses: [
      {
        id: 'seren',
        name: '세렌',
        category: 'grandis',
        maxPartySize: 6,
        difficulties: { normal: 239000000, hard: 356000000, extreme: 2835000000 },
        dropItems: [{ id: 'estella_earring', name: '에스텔라 이어링' }],
      },
      {
        id: 'kalos',
        name: '칼로스',
        category: 'grandis',
        maxPartySize: 6,
        difficulties: { easy: 280000000, normal: 505000000, hard: 1273000000, extreme: 4140000000 },
        dropItems: [{ id: 'estella_earring', name: '에스텔라 이어링' }],
      },
      { id: 'originator', name: '최초의 대적자', category: 'grandis', maxPartySize: 3, difficulties: { easy: 308000000, normal: 560000000, hard: 1435000000, extreme: 4712000000 } },
      {
        id: 'kaling',
        name: '카링',
        category: 'grandis',
        maxPartySize: 6,
        difficulties: { easy: 377000000, normal: 678000000, hard: 1739000000, extreme: 5387000000 },
        dropItems: [{ id: 'estella_earring', name: '에스텔라 이어링' }],
      },
      {
        id: 'bellona',
        name: '벨로나',
        category: 'grandis',
        maxPartySize: 3,
        difficulties: { easy: 440000000, normal: 850000000, hard: 2950000000 },
      },
      {
        id: 'radiant_horn',
        name: '찬란한 흉성',
        category: 'grandis',
        maxPartySize: 3,
        difficulties: { normal: 625000000, hard: 2678000000 },
        dropItems: [{ id: 'twilight_mark', name: '트와일라이트 마크' }],
      },
      {
        id: 'limbo',
        name: '림보',
        category: 'grandis',
        maxPartySize: 3,
        difficulties: { normal: 1026000000, hard: 2385000000 },
        dropItems: [{ id: 'estella_earring', name: '에스텔라 이어링' }],
      },
      {
        id: 'valdrics',
        name: '발드릭스',
        category: 'grandis',
        maxPartySize: 3,
        difficulties: { normal: 1368000000, hard: 3078000000 },
        dropItems: [{ id: 'estella_earring', name: '에스텔라 이어링' }],
      },
      {
        id: 'jupiter',
        name: '유피테르',
        category: 'grandis',
        maxPartySize: 3,
        difficulties: { normal: 1615000000, hard: 4845000000 },
        dropItems: [{ id: 'estella_earring', name: '에스텔라 이어링' }],
      },
      {
        id: 'meirin',
        name: '메이린',
        category: 'grandis',
        maxPartySize: 1,
        rewardKind: 'fixed',
        accountWide: true,
        seasonal: true,
        difficulties: { normal: 300000000, hard: 600000000 },
      },
    ],
  },
  {
    key: 'subboss',
    label: '검밑솔',
    description: '스우부터 검은 마법사까지 검밑솔 구간',
    columns: ['easy', 'normal', 'hard', 'extreme'],
    bosses: [
      
      { id: 'suu', name: '스우', category: 'subboss', maxPartySize: 6, difficultyMaxPartySize: { extreme: 2 }, difficulties: { normal: 17600000, hard: 54200000, extreme: 604000000 } },
      { id: 'damien', name: '데미안', category: 'subboss', maxPartySize: 6, difficulties: { normal: 18400000, hard: 51500000 } },
      {
        id: 'slime',
        name: '가엔슬',
        category: 'subboss',
        maxPartySize: 6,
        difficulties: { normal: 25500000, hard: 75100000 },
        dropItems: [{ id: 'dominator_pendant', name: '도미네이터 펜던트' }],
      },
      {
        id: 'lucid',
        name: '루시드',
        category: 'subboss',
        maxPartySize: 6,
        difficulties: { easy: 29800000, normal: 35600000, hard: 62900000 },
        dropItems: [
          { id: 'daybreak_pendant', name: '데이브레이크 펜던트' },
          { id: 'twilight_mark', name: '트와일라이트 마크' },
        ],
      },
      {
        id: 'will',
        name: '윌',
        category: 'subboss',
        maxPartySize: 6,
        difficulties: { easy: 32300000, normal: 41100000, hard: 77100000 },
        dropItems: [
          { id: 'daybreak_pendant', name: '데이브레이크 펜던트' },
          { id: 'twilight_mark', name: '트와일라이트 마크' },
        ],
      },
      {
        id: 'dusk',
        name: '더스크',
        category: 'subboss',
        maxPartySize: 6,
        difficulties: { normal: 44000000, hard: 69800000 },
        dropItems: [{ id: 'twilight_mark', name: '트와일라이트 마크' }],
      },
      { id: 'jinhilla', name: '진 힐라', category: 'subboss', maxPartySize: 6, difficulties: { normal: 74900000, hard: 112000000 } },
      {
        id: 'darknell',
        name: '듄켈',
        category: 'subboss',
        maxPartySize: 6,
        difficulties: { normal: 71200000, hard: 106000000 },
        dropItems: [{ id: 'estella_earring', name: '에스텔라 이어링' }],
      },
      { id: 'black_mage', name: '검은 마법사', category: 'subboss', maxPartySize: 6, resetCycle: 'monthly', difficulties: { hard: 700000000, extreme: 9200000000 } },
    ],
  },
  {
    key: 'general',
    label: '일반 보스',
    description: '자쿰부터 시그너스까지 기본 주간 보스',
    columns: ['easy', 'normal', 'hard'],
    bosses: [
      { id: 'zakum', name: '자쿰', category: 'general', maxPartySize: 6, difficulties: { hard: 8080000 } },
      { id: 'magnus', name: '매그너스', category: 'general', maxPartySize: 6, difficulties: {  hard: 8560000 } },
      { id: 'hilla', name: '힐라', category: 'general', maxPartySize: 6, difficulties: {  hard: 1280000 } },
      {
        id: 'papulatus',
        name: '파풀라투스',
        category: 'general',
        maxPartySize: 6,
        difficulties: {  hard: 13100000 },
        dropItems: [{ id: 'papulatus_mark', name: '파풀라투스 마크' }],
      },
      { id: 'pierre', name: '피에르', category: 'general', maxPartySize: 6, difficulties: { hard: 8170000 } },
      { id: 'vonbon', name: '반반', category: 'general', maxPartySize: 6, difficulties: {hard: 8150000 } },
      { id: 'crimsonqueen', name: '블러디퀸', category: 'general', maxPartySize: 6, difficulties: { hard: 8140000 } },
      { id: 'vellum', name: '벨룸', category: 'general', maxPartySize: 6, difficulties: {  hard: 9280000 } },
      
      
      {
        id: 'pinkbean',
        name: '핑크빈',
        category: 'general',
        maxPartySize: 6,
        difficulties: {hard: 1320000 },
        dropItems: [{ id: 'blackbean_mark', name: '블랙빈 마크' }],
      },
      { id: 'cygnus', name: '시그너스', category: 'general', maxPartySize: 6, difficulties: {normal: 1360000 } },
    ],
  },
];

export function getBossCategory(key: BossCategoryKey) {
  return BOSS_CATALOG.find((group) => group.key === key) ?? BOSS_CATALOG[0];
}
