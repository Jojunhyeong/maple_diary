export type BossDropItemOption = {
  id: string;
  label: string;
  iconLabel: string;
  imageUrl?: string;
};

function wikiImageUrl(fileName: string) {
  if (fileName.startsWith('http://') || fileName.startsWith('https://')) {
    return fileName;
  }
  return `https://media.maplestorywiki.net/yetidb/${fileName}`;
}

export const BOSS_DROP_ITEM_OPTIONS: BossDropItemOption[] = [
  { id: 'lucid_ring', label: '루즈 컨트롤 머신 마크', iconLabel: '루컨마', imageUrl: wikiImageUrl('https://media.maplestorywiki.net/yetidb/Eqp_Berserked.png') },
  { id: 'complete_undercontrol', label: '컴플리트 언더컨트롤', iconLabel: '컴언', imageUrl: wikiImageUrl('https://media.maplestorywiki.net/yetidb/Eqp_Total_Control.png') },
  { id: 'black_veil', label: '마력이 깃든 안대', iconLabel: '안대', imageUrl: wikiImageUrl('https://media.maplestorywiki.net/yetidb/Eqp_Magic_Eyepatch.png') },
  { id: 'cursed_belt', label: '몽환의 벨트', iconLabel: '벨트', imageUrl: wikiImageUrl('https://media.maplestorywiki.net/yetidb/Eqp_Dreamy_Belt.png') },
  { id: 'cursed_tome_box', label: '저주받은 마도서 선택 상자', iconLabel: '마도서', imageUrl: wikiImageUrl('https://media.maplestorywiki.net/yetidb/Use_Will%27s_Cursed_Spellbook_Selection_Box.png') },
  { id: 'great_fear', label: '거대한 공포', iconLabel: '공포', imageUrl: wikiImageUrl('https://media.maplestorywiki.net/yetidb/Eqp_Endless_Terror.png') },
  { id: 'root_of_agony', label: '고통의 근원', iconLabel: '근원', imageUrl: wikiImageUrl('https://media.maplestorywiki.net/yetidb/Eqp_Source_of_Suffering.png') },
  { id: 'commander_force_earring', label: '커맨더 포스 이어링', iconLabel: '이어링', imageUrl: wikiImageUrl('Eqp_Commanding_Force_Earring.png') },
  { id: 'genesis_badge', label: '창세의 뱃지', iconLabel: '뱃지', imageUrl: wikiImageUrl('https://media.maplestorywiki.net/yetidb/Eqp_Genesis_Badge.png') },
  { id: 'exceptional_hammer', label: '익셉셔널 해머', iconLabel: '해머', imageUrl: wikiImageUrl('https://media.maplestorywiki.net/yetidb/Use_Exceptional_Hammer_%28Belt%29.png') },
  { id: 'mitra_wrath_box', label: '미트라의 분노 선택 상자', iconLabel: '미트라', imageUrl: wikiImageUrl('https://media.maplestorywiki.net/yetidb/Use_Mitra%27s_Rage_Selection_Box.png') },
  { id: 'glowing_moon_potion', label: '영롱한 달빛 포션', iconLabel: '포션', imageUrl: wikiImageUrl('https://media.maplestorywiki.net/yetidb/Use_Bright_Moonlight_Potion.png') },
  { id: 'life_grindstone', label: '생명의 연마석', iconLabel: '생명석', imageUrl: wikiImageUrl('https://media.maplestorywiki.net/yetidb/Use_Grindstone_of_Life.png') },
  { id: 'belief_grindstone', label: '신념의 연마석', iconLabel: '신념석', imageUrl: wikiImageUrl('https://media.maplestorywiki.net/yetidb/Use_Grindstone_of_Faith.png') },
  { id: 'eternel_armor_box_top', label: '에테르넬 방어구 상자(모,상,하,견)', iconLabel: '에테르넬', imageUrl: wikiImageUrl('https://media.maplestorywiki.net/yetidb/Use_Divine_Eternal_Armor_Box.png') },
  { id: 'eternel_armor_box_bottom', label: '에테르넬 방어구 상자(장,신,망)', iconLabel: '에테르넬', imageUrl: wikiImageUrl('https://media.maplestorywiki.net/yetidb/Use_Eternal_Armor_of_Oaths_Box.png') },
  { id: 'voice_of_origin', label: '근원의 속삭임', iconLabel: '속삭임', imageUrl: wikiImageUrl('https://media.maplestorywiki.net/yetidb/Eqp_Whisper_of_the_Source.png') },
  { id: 'death_vow', label: '죽음의 맹세', iconLabel: '맹세', imageUrl: wikiImageUrl('https://media.maplestorywiki.net/yetidb/Eqp_Oath_of_Death.png') },
  { id: 'immortal_legacy', label: '불멸의 유산', iconLabel: '유산', imageUrl: wikiImageUrl('https://media.maplestorywiki.net/yetidb/Eqp_Immortal_Legacy.png') },
  { id: 'blissful_nightmare', label: '황홀한 악몽', iconLabel: '악몽', imageUrl: wikiImageUrl('https://media.maplestorywiki.net/yetidb/Eqp_Entrancing_Nightmare.png') },
  { id: 'arrogance_sin', label: '오만의 원죄', iconLabel: '원죄', imageUrl: wikiImageUrl('https://media.maplestorywiki.net/yetidb/Eqp_Original_Sin_of_Pride.png') },
  { id: 'restraint_ring_4', label: '리스트레인트 링 lv4', iconLabel: '링4', imageUrl: wikiImageUrl('https://media.maplestorywiki.net/yetidb/Eqp_Ring_of_Restraint.png') },
  { id: 'continuous_ring_4', label: '컨티뉴어스 링 lv4', iconLabel: '링4', imageUrl: wikiImageUrl('https://media.maplestorywiki.net/yetidb/Eqp_Continuous_Ring.png') },
];

export function getBossDropItemOption(itemId: string) {
  return BOSS_DROP_ITEM_OPTIONS.find((item) => item.id === itemId);
}
