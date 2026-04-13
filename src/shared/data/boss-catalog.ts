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
    description: '세렌부터 유피테르까지 그란디스 레이드 보스',
    columns: ['easy', 'normal', 'hard', 'extreme'],
    bosses: [
      { id: 'seren', name: '세렌', category: 'grandis', maxPartySize: 6, difficulties: { normal: 266000000, hard: 396000000, extreme: 3150000000 } },
      { id: 'kalos', name: '칼로스', category: 'grandis', maxPartySize: 6, difficulties: { easy: 311000000, normal: 561000000, hard: 1340000000, extreme: 4320000000 } },
      { id: 'originator', name: '최초의 대적자', category: 'grandis', maxPartySize: 3, difficulties: { easy: 324000000, normal: 589000000, hard: 1510000000, extreme: 4960000000 } },
      { id: 'kaling', name: '카링', category: 'grandis', maxPartySize: 6, difficulties: { easy: 419000000, normal: 714000000, hard: 1830000000, extreme: 5670000000 } },
      { id: 'radiant_horn', name: '찬란한 흉성', category: 'grandis', maxPartySize: 3, difficulties: { normal: 658000000, hard: 2819000000 } },
      { id: 'limbo', name: '림보', category: 'grandis', maxPartySize: 3, difficulties: { normal: 1080000000, hard: 2510000000 } },
      { id: 'valdrics', name: '발드릭스', category: 'grandis', maxPartySize: 3, difficulties: { normal: 1440000000, hard: 3240000000 } },
      { id: 'jupiter', name: '유피테르', category: 'grandis', maxPartySize: 3, difficulties: { normal: 1700000000, hard: 5100000000 } },
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
      { id: 'slime', name: '가엔슬', category: 'subboss', maxPartySize: 6, difficulties: { normal: 26800000, hard: 79100000 } },
      { id: 'lucid', name: '루시드', category: 'subboss', maxPartySize: 6, difficulties: { easy: 31400000, normal: 37500000, hard: 66200000 } },
      { id: 'will', name: '윌', category: 'subboss', maxPartySize: 6, difficulties: { easy: 34000000, normal: 43300000, hard: 81200000 } },
      { id: 'dusk', name: '더스크', category: 'subboss', maxPartySize: 6, difficulties: { normal: 46300000, hard: 73500000 } },
      { id: 'jinhilla', name: '진 힐라', category: 'subboss', maxPartySize: 6, difficulties: { normal: 74900000, hard: 112000000 } },
      { id: 'darknell', name: '듄켈', category: 'subboss', maxPartySize: 6, difficulties: { normal: 50000000, hard: 99400000 } },
      { id: 'black_mage', name: '검은 마법사', category: 'subboss', maxPartySize: 6, resetCycle: 'monthly', difficulties: { hard: 700000000, extreme: 9200000000 } },
    ],
  },
  {
    key: 'general',
    label: '일반 보스',
    description: '자쿰부터 시그너스까지 기본 주간 보스',
    columns: ['easy', 'normal', 'hard'],
    bosses: [
      { id: 'zakum', name: '자쿰', category: 'general', maxPartySize: 6, difficulties: { easy: 114000, normal: 349000, hard: 8080000 } },
      { id: 'magnus', name: '매그너스', category: 'general', maxPartySize: 6, difficulties: { easy: 411000, normal: 1480000, hard: 8560000 } },
      { id: 'hilla', name: '힐라', category: 'general', maxPartySize: 6, difficulties: { normal: 455000, hard: 5750000 } },
      { id: 'papulatus', name: '파풀라투스', category: 'general', maxPartySize: 6, difficulties: { easy: 390000, normal: 1520000, hard: 13800000 } },
      { id: 'pierre', name: '피에르', category: 'general', maxPartySize: 6, difficulties: { normal: 551000, hard: 8170000 } },
      { id: 'vonbon', name: '반반', category: 'general', maxPartySize: 6, difficulties: { normal: 551000, hard: 8150000 } },
      { id: 'crimsonqueen', name: '블러디퀸', category: 'general', maxPartySize: 6, difficulties: { normal: 551000, hard: 8140000 } },
      { id: 'vellum', name: '벨룸', category: 'general', maxPartySize: 6, difficulties: { normal: 551000, hard: 9280000 } },
      { id: 'vonleon', name: '반 레온', category: 'general', maxPartySize: 6, difficulties: { easy: 602000, normal: 830000, hard: 1390000 } },
      { id: 'horntail', name: '혼테일', category: 'general', maxPartySize: 6, difficulties: { easy: 502000, normal: 576000, hard: 770000 } },
      { id: 'arkarium', name: '아카이럼', category: 'general', maxPartySize: 6, difficulties: { easy: 656000, normal: 1430000 } },
      { id: 'pinkbean', name: '핑크빈', category: 'general', maxPartySize: 6, difficulties: { normal: 799000, hard: 6580000 } },
      { id: 'cygnus', name: '시그너스', category: 'general', maxPartySize: 6, difficulties: { easy: 4550000, normal: 7500000 } },
    ],
  },
];

export function getBossCategory(key: BossCategoryKey) {
  return BOSS_CATALOG.find((group) => group.key === key) ?? BOSS_CATALOG[0];
}
