'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type { EquipmentGuideStat, EquipmentSlotId, OwnEquipment } from './model';
import { EQUIPMENT_SLOTS } from './model';
import { optionLabel } from './aggregate';
import styles from './styles.module.css';

export function Compare({ characterName, characterJob, selectedSlot, stat }: { characterName?: string; characterJob?: string; selectedSlot: EquipmentSlotId; stat?: EquipmentGuideStat }) {
  const query = useQuery({
    queryKey: ['equipment-guide-own-equipment', characterName],
    enabled: !!characterName,
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/maple/character-equipment?name=' + encodeURIComponent(characterName!), { signal });
      if (!response.ok) throw new Error('장비 정보를 불러오지 못했어요.');
      return await response.json() as { items: OwnEquipment[] };
    },
  });
  const slot = EQUIPMENT_SLOTS.find(item => item.id === selectedSlot);
  const own = query.data?.items.find(item => item.slot === slot?.apiSlot);
  const star = own?.raw?.starforce;
  const difference = star != null && star !== '' && Number.isFinite(Number(star)) && stat?.starforce.median !== undefined ? Number(star) - stat.starforce.median : null;
  return <section className={styles.compare}><h2>내 장비와 비교하기</h2>
    {!characterName ? <p>캐릭터를 선택하면 내 장비를 함께 확인할 수 있어요. <Link href="/settings">캐릭터 선택 →</Link></p>
      : query.isPending ? <p role="status">내 장비를 불러오는 중이에요.</p>
      : query.isError ? <p role="alert">{query.error.message} <button onClick={() => void query.refetch()}>다시 시도</button></p>
      : !own ? <p>{characterName}의 해당 부위 장비 정보가 없어요.</p>
      : !stat ? <><p>{characterName} · {slot?.label} · {own.name}</p><p>스타포스: {star != null && star !== '' ? star + '성' : '정보 없음'}<br />잠재능력: {optionLabel(own.raw ?? {})}<br />에디셔널: {optionLabel(own.raw ?? {}, true)}</p><p className={styles.sample}>{characterJob}의 선택 구간 표본이 확보되면 내 장비와 비교할 수 있어요.</p></>
      : <><p>{characterName} · {own.name} <span className={styles.sample}>/ 비교 기준은 수집한 실제 장비 표본입니다.</span></p>
        {characterJob !== stat.job && <p className={styles.notice}>내 캐릭터와 선택한 통계의 직업이 달라요.</p>}
        <div className={styles.tableWrap}><table><thead><tr><th>항목</th><th>내 장비</th><th>가까운 전투력 표본</th></tr></thead><tbody>
          <tr><th>스타포스</th><td>{star ? star + '성' : '정보 없음'}</td><td>중앙값 {stat.starforce.median ?? '—'}성</td></tr>
          <tr><th>잠재능력</th><td>{own.raw?.potential_option_grade || '정보 없음'}<br />{optionLabel(own.raw ?? {})}</td><td>{stat.potentialOptions?.[0]?.label ?? '정보 없음'}<br />{stat.potentialOptions?.[0]?.ratio ?? 0}% 사용</td></tr>
          <tr><th>에디셔널</th><td>{own.raw?.additional_potential_option_grade || '정보 없음'}<br />{optionLabel(own.raw ?? {}, true)}</td><td>{stat.additionalPotentialOptions?.[0]?.label ?? '정보 없음'}<br />{stat.additionalPotentialOptions?.[0]?.ratio ?? 0}% 사용</td></tr>
        </tbody></table></div>
        {difference !== null && <p>스타포스는 비교 표본의 대표 아이템 중앙값{difference === 0 ? '과 같아요.' : '보다 ' + Math.abs(difference) + '성 ' + (difference > 0 ? '높아요.' : '낮아요.')}</p>}
      </>}
  </section>;
}
