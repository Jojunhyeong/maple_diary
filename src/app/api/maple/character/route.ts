import { NextRequest, NextResponse } from 'next/server';

const MAPLE_API_BASE = 'https://open.api.nexon.com/maplestory/v1';

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

    // 2. 기본 정보 조회
    const basicRes = await fetch(
      `${MAPLE_API_BASE}/character/basic?ocid=${ocid}`,
      { headers: { 'x-nxopen-api-key': apiKey } },
    );

    if (!basicRes.ok) {
      return NextResponse.json({ error: '캐릭터 정보 조회 실패' }, { status: 500 });
    }

    const basic = await basicRes.json();

    return NextResponse.json({
      character_name: basic.character_name,
      character_class: basic.character_class,
      character_level: basic.character_level,
      character_image: basic.character_image,
      ocid,
    });
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}
