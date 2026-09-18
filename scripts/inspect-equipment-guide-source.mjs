import nextEnv from '@next/env';
import { mkdir, writeFile } from 'node:fs/promises';
import { itemsHaveFarmingPotential } from '../src/widgets/equipment-guide/aggregate.ts';

nextEnv.loadEnvConfig(process.cwd());

const characterName = process.argv[2]?.trim();
const date = process.argv[3] || new Date(Date.now() - 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
const apiKey = process.env.NEXON_API_KEY || process.env.NEXT_PUBLIC_MAPLE_API_KEY;

if (!characterName) throw new Error('사용법: npm run inspect:equipment-guide -- 캐릭터명 [YYYY-MM-DD]');
if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date))) throw new Error('날짜는 YYYY-MM-DD 형식이어야 합니다.');
if (!apiKey) throw new Error('NEXON_API_KEY가 필요합니다.');

async function nexon(path, params) {
  const response = await fetch(`https://open.api.nexon.com/maplestory/v1/${path}?${new URLSearchParams(params)}`, {
    headers: { 'x-nxopen-api-key': apiKey },
    signal: AbortSignal.timeout(20_000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Nexon ${path}: HTTP ${response.status} ${body?.error?.name ?? ''}`.trim());
  return body;
}

const id = await nexon('id', { character_name: characterName });
if (!id?.ocid) throw new Error('OCID를 찾지 못했습니다.');
const [stat, equipment] = await Promise.all([
  nexon('character/stat', { ocid: id.ocid, date }),
  nexon('character/item-equipment', { ocid: id.ocid, date }),
]);

const combatPower = Number(stat.final_stat?.find(value => value.stat_name === '전투력')?.stat_value);
const appliedItems = Array.isArray(equipment.item_equipment) ? equipment.item_equipment : [];
const presets = [1, 2, 3].map(presetNo => {
  const items = Array.isArray(equipment[`item_equipment_preset_${presetNo}`]) ? equipment[`item_equipment_preset_${presetNo}`] : [];
  return {
    presetNo,
    itemCount: items.length,
    applied: Number(equipment.preset_no) === presetNo,
    hasDropOrMesoPotential: itemsHaveFarmingPotential(items),
  };
});
const summary = {
  characterName,
  date,
  characterClass: stat.character_class,
  combatPower: Number.isFinite(combatPower) ? combatPower : null,
  appliedEquipmentPresetNo: equipment.preset_no ?? null,
  appliedItemCount: appliedItems.length,
  appliedHasDropOrMesoPotential: itemsHaveFarmingPotential(appliedItems),
  presets,
  explanation: 'combatPower는 stat.json의 현재 스탯이며, appliedEquipmentPresetNo와 equipment.json의 item_equipment가 같은 날짜의 실제 적용 장비입니다.',
};

const safeName = characterName.replaceAll(/[^0-9A-Za-z가-힣_-]/g, '_');
const outputDirectory = `.cache/equipment-guide-inspect/${safeName}-${date}`;
await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(`${outputDirectory}/id.json`, JSON.stringify(id, null, 2)),
  writeFile(`${outputDirectory}/stat.json`, JSON.stringify(stat, null, 2)),
  writeFile(`${outputDirectory}/equipment.json`, JSON.stringify(equipment, null, 2)),
  writeFile(`${outputDirectory}/summary.json`, JSON.stringify(summary, null, 2)),
]);

console.log(JSON.stringify({ outputDirectory, ...summary }, null, 2));
