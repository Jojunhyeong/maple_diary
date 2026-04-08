import { NextRequest, NextResponse } from 'next/server';

const MAPLE_API_BASE = 'https://open.api.nexon.com/maplestory/v1';

function parseCombatPower(finalStats: unknown): number | null {
  if (!Array.isArray(finalStats)) return null;

  for (const stat of finalStats) {
    if (!stat || typeof stat !== 'object') continue;
    const name = (stat as { stat_name?: unknown }).stat_name;
    const value = (stat as { stat_value?: unknown }).stat_value;

    if (typeof name !== 'string' || typeof value !== 'string') continue;
    if (!name.includes('전투력')) continue;

    const parsed = Number(value.replace(/[^\d]/g, ''));
    if (!Number.isNaN(parsed)) return parsed;
  }

  return null;
}

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get('name');
  if (!name) {
    return NextResponse.json({ error: '캐릭터 이름이 필요합니다' }, { status: 400 });
  }

  const apiKey = process.env.NEXT_PUBLIC_MAPLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'API 키가 설정되지 않았습니다' }, { status: 500 });
  }

  try {
    // 1. ocid 조회
    const ocidRes = await fetch(
      `${MAPLE_API_BASE}/id?character_name=${encodeURIComponent(name)}`,
      { headers: { 'x-nxopen-api-key': apiKey } },
    );

    if (!ocidRes.ok) {
      const err = await ocidRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.error?.message || '캐릭터를 찾을 수 없습니다' },
        { status: 404 },
      );
    }

    const { ocid } = await ocidRes.json();

    // 2. 기본 정보 + 스탯 조회
    const [basicRes, statRes] = await Promise.all([
      fetch(
        `${MAPLE_API_BASE}/character/basic?ocid=${ocid}`,
        { headers: { 'x-nxopen-api-key': apiKey } },
      ),
      fetch(
        `${MAPLE_API_BASE}/character/stat?ocid=${ocid}`,
        { headers: { 'x-nxopen-api-key': apiKey } },
      ),
    ]);

    if (!basicRes.ok) {
      return NextResponse.json({ error: '캐릭터 정보 조회 실패' }, { status: 500 });
    }

    const basic = await basicRes.json();
    const stat = statRes.ok ? await statRes.json().catch(() => null) : null;
    const combatPower = parseCombatPower(stat?.final_stat);

    return NextResponse.json({
      character_name: basic.character_name,
      character_world: basic.world_name ?? null,
      character_class: basic.character_class,
      character_level: basic.character_level,
      character_exp_rate: basic.character_exp_rate ?? null,
      character_combat_power: combatPower,
      character_image: basic.character_image,
      ocid,
    });
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}
