'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type { EquipmentGuideLoadout, EquipmentGuideLoadoutItem, EquipmentSlotId, OwnEquipment } from './model';
import { EQUIPMENT_SLOTS } from './model';
import { optionLabel } from './aggregate';
import styles from './styles.module.css';

export function Compare({ characterName, selectedSlot, recommended }: { characterName?: string; selectedSlot: EquipmentSlotId; recommended: { loadout: EquipmentGuideLoadout; item: EquipmentGuideLoadoutItem } }) {
  const query = useQuery({
    queryKey: ['equipment-guide-own-equipment', characterName],
    enabled: !!characterName,
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/maple/character-equipment?name=' + encodeURIComponent(characterName!), { signal });
      if (!response.ok) throw new Error('장비 정보를 불러오지 못했어요.');
      return await response.json() as { items: OwnEquipment[]; equipment_preset_no?: number | null };
    },
  });
  const slot = EQUIPMENT_SLOTS.find(item => item.id === selectedSlot);
  const own = query.data?.items.find(item => item.slot === slot?.apiSlot);
  const star = own?.raw?.starforce;
  const comparisonStar = recommended.item.starforce;
  const difference = star != null && star !== '' && Number.isFinite(Number(star)) && comparisonStar !== undefined ? Number(star) - comparisonStar : null;
  return <section className={styles.compare}><h2>{slot?.label} · 내 장비와 비교</h2>
    {query.data?.equipment_preset_no && <p className={styles.sample}>드롭률·메소 획득량 잠재가 없는 장비 프리셋 {query.data.equipment_preset_no}번을 사용합니다.</p>}
    {!characterName ? <p>캐릭터를 선택하면 내 장비를 함께 확인할 수 있어요. <Link href="/settings">캐릭터 선택 →</Link></p>
      : query.isPending ? <p role="status">내 장비를 불러오는 중이에요.</p>
      : query.isError ? <p role="alert">{query.error.message} <button onClick={() => void query.refetch()}>다시 시도</button></p>
      : !own ? <p>{characterName}의 해당 부위 장비 정보가 없어요.</p>
      : <><p>{characterName} · {own.name}</p><p className={styles.sample}>추천 세팅 장비: {recommended.item.itemName} · 전투력 {formatPower(recommended.loadout.power)} 캐릭터의 실제 조합</p>
        <div className={styles.tableWrap}><table><thead><tr><th>항목</th><th>내 장비</th><th>추천 세팅</th></tr></thead><tbody>
          <tr><th>장비</th><td>{own.name}</td><td>{recommended.item.itemName}</td></tr>
          <tr><th>스타포스</th><td>{star != null && star !== '' ? star + '성' : '정보 없음'}</td><td>{recommended.item.starforce !== undefined ? recommended.item.starforce + '성' : '정보 없음'}</td></tr>
          <tr><th>잠재능력</th><td>{own.raw?.potential_option_grade || '정보 없음'}<br />{optionLabel(own.raw ?? {})}</td><td>{recommended.item.potentialGrade || '정보 없음'}<br />{recommended.item.potentialOption || '옵션 없음'}</td></tr>
          <tr><th>에디셔널</th><td>{own.raw?.additional_potential_option_grade || '정보 없음'}<br />{optionLabel(own.raw ?? {}, true)}</td><td>{recommended.item.additionalPotentialGrade || '정보 없음'}<br />{recommended.item.additionalPotentialOption || '옵션 없음'}</td></tr>
        </tbody></table></div>
        {difference !== null && <p>스타포스는 추천 세팅 장비{difference === 0 ? '와 같아요.' : '보다 ' + Math.abs(difference) + '성 ' + (difference > 0 ? '높아요.' : '낮아요.')}</p>}
      </>}
  </section>;
}

function formatPower(value: number) {
  return value >= 100_000_000 ? `${Math.round(value / 1_000_000) / 100}억` : `${Math.round(value / 1_000_000)}백만`;
}
