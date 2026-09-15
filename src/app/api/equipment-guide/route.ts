import { NextRequest, NextResponse } from 'next/server';
import snapshot from '@/shared/data/equipment-guide-snapshot.json';
import { COMBAT_BUCKETS, type EquipmentGuideStat } from '@/widgets/equipment-guide/model';

export async function GET(request: NextRequest) {
  const job = request.nextUrl.searchParams.get('job') ?? '';
  const bucket = request.nextUrl.searchParams.get('bucket') ?? '';
  if (!job.trim() || job.length > 40 || !COMBAT_BUCKETS.some(value => value.id === bucket)) {
    return NextResponse.json({ error: '직업과 전투력 구간을 확인해 주세요.' }, { status: 400 });
  }
  // Nexon data must be refreshed within 30 days. Never serve expired statistics.
  const date = snapshot.date as string | null;
  const stale = !date || Date.now() - Date.parse(date + 'T00:00:00+09:00') >= 30 * 86400000;
  const stats = stale ? [] : (snapshot.stats as EquipmentGuideStat[]).filter(stat => stat.job === job && stat.combatPowerBucket === bucket);
  return NextResponse.json({ source: 'api', stats, date, stale, method: snapshot.method }, { headers: { 'Cache-Control': 'public, max-age=300' } });
}
