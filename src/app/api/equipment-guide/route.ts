import { NextRequest, NextResponse } from 'next/server';
import snapshot from '@/shared/data/equipment-guide-snapshot.json';
import { COMBAT_BUCKETS, type EquipmentGuideStat } from '@/widgets/equipment-guide/model';

type LegacyEquipmentGuideStat = Omit<EquipmentGuideStat, 'cohortPower' | 'powerMin' | 'powerMax'> & { combatPowerBucket: string };

export async function GET(request: NextRequest) {
  const job = request.nextUrl.searchParams.get('job') ?? '';
  const targetPower = Number(request.nextUrl.searchParams.get('power'));
  if (!job.trim() || job.length > 40 || !Number.isFinite(targetPower) || targetPower <= 0) {
    return NextResponse.json({ error: '직업과 전투력을 확인해 주세요.' }, { status: 400 });
  }
  // Nexon data must be refreshed within 30 days. Never serve expired statistics.
  const date = snapshot.date as string | null;
  const stale = !date || Date.now() - Date.parse(date + 'T00:00:00+09:00') >= 30 * 86400000;
  // The checked-in snapshot may still be the previous schema during a rolling deployment.
  const allStats = stale ? [] : snapshot.stats as unknown as Array<EquipmentGuideStat | LegacyEquipmentGuideStat>;
  const jobStats = allStats.filter((stat): stat is EquipmentGuideStat => stat.job === job && 'cohortPower' in stat && Number.isFinite(stat.cohortPower));
  const cohortPower = jobStats.reduce<number | undefined>((nearest, stat) => nearest === undefined || Math.abs(stat.cohortPower - targetPower) < Math.abs(nearest - targetPower) ? stat.cohortPower : nearest, undefined);
  let stats: Array<EquipmentGuideStat | LegacyEquipmentGuideStat> = cohortPower === undefined ? [] : jobStats.filter(stat => stat.cohortPower === cohortPower);
  let reference = stats[0];
  let powerMin = reference && 'powerMin' in reference ? reference.powerMin : undefined;
  let powerMax = reference && 'powerMax' in reference ? reference.powerMax : undefined;
  // Keep serving the previous fixed-bin snapshot while a fresh cohort snapshot is being collected.
  if (!stats.length) {
    const bucket = COMBAT_BUCKETS.find((value, index) => targetPower >= value.min && (targetPower < value.max || (index === COMBAT_BUCKETS.length - 1 && targetPower === value.max)));
    stats = bucket ? allStats.filter((stat): stat is LegacyEquipmentGuideStat => stat.job === job && 'combatPowerBucket' in stat && stat.combatPowerBucket === bucket.id) : [];
    reference = stats[0];
    powerMin = bucket?.min;
    powerMax = bucket?.max;
  }
  const cohort = reference && powerMin !== undefined && powerMax !== undefined ? { targetPower, powerMin, powerMax, characterCount: Math.max(...stats.map(stat => stat.sampleCount)) } : undefined;
  return NextResponse.json({ source: 'api', stats, cohort, date, stale, method: snapshot.method }, { headers: { 'Cache-Control': 'public, max-age=300' } });
}
