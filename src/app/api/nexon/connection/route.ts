import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/../auth';
import { supabaseAdmin } from '@/shared/lib/supabase';
import { encryptNexonApiKey } from '@/shared/lib/server/nexon-api-key';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NEXON_API_BASE = 'https://open.api.nexon.com/maplestory/v1';
const VALID_DISCOUNT_RATES = new Set([0, 3, 5, 10, 15]);

type ConnectionRow = {
  api_key_last4: string;
  nexon_ouid: string;
  starforce_discount_rate: number;
  connected_at: string;
  last_synced_at: string | null;
};

function tableMissing(error: { code?: string } | null) {
  return error?.code === '42P01' || error?.code === 'PGRST205';
}

function connectionResponse(row: ConnectionRow | null) {
  if (!row) return { connected: false };
  return {
    connected: true,
    apiKeyLast4: row.api_key_last4,
    nexonOuid: row.nexon_ouid,
    starforceDiscountRate: row.starforce_discount_rate,
    connectedAt: row.connected_at,
    lastSyncedAt: row.last_synced_at,
  };
}

async function validateNexonApiKey(apiKey: string) {
  const response = await fetch(`${NEXON_API_BASE}/ouid`, {
    headers: { 'x-nxopen-api-key': apiKey },
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const message =
      response.status === 429
        ? '넥슨 API 요청이 많아요. 잠시 후 다시 시도해 주세요.'
        : '유효하지 않거나 본인 계정 정보를 조회할 수 없는 API 키예요.';
    throw new Error(message);
  }

  const payload = (await response.json()) as { ouid?: unknown };
  if (typeof payload.ouid !== 'string' || !payload.ouid) {
    throw new Error('넥슨 계정 식별자를 확인하지 못했어요.');
  }
  return payload.ouid;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from('nexon_api_connections')
    .select('api_key_last4, nexon_ouid, starforce_discount_rate, connected_at, last_synced_at')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (tableMissing(error)) {
    return NextResponse.json(
      { error: '넥슨 연동용 DB 설정이 필요합니다. supabase_create_nexon_enhancement_sync.sql을 실행해 주세요.' },
      { status: 503 },
    );
  }
  if (error) return NextResponse.json({ error: '넥슨 연결 상태를 불러오지 못했어요.' }, { status: 500 });
  return NextResponse.json(connectionResponse(data as ConnectionRow | null));
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    apiKey?: unknown;
    starforceDiscountRate?: unknown;
  };
  const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
  const discountRate = Number(body.starforceDiscountRate ?? 0);

  if (apiKey.length < 20 || apiKey.length > 500) {
    return NextResponse.json({ error: '올바른 넥슨 Open API 키를 입력해 주세요.' }, { status: 400 });
  }
  if (!VALID_DISCOUNT_RATES.has(discountRate)) {
    return NextResponse.json({ error: '지원하지 않는 할인율이에요.' }, { status: 400 });
  }

  try {
    const ouid = await validateNexonApiKey(apiKey);
    const now = new Date().toISOString();
    const db = supabaseAdmin();
    const { data, error } = await db
      .from('nexon_api_connections')
      .upsert(
        {
          user_id: session.user.id,
          encrypted_api_key: encryptNexonApiKey(apiKey),
          api_key_last4: apiKey.slice(-4),
          nexon_ouid: ouid,
          starforce_discount_rate: discountRate,
          connected_at: now,
          updated_at: now,
        },
        { onConflict: 'user_id' },
      )
      .select('api_key_last4, nexon_ouid, starforce_discount_rate, connected_at, last_synced_at')
      .single();

    if (tableMissing(error)) {
      return NextResponse.json(
        { error: '넥슨 연동용 DB 설정이 필요합니다. supabase_create_nexon_enhancement_sync.sql을 실행해 주세요.' },
        { status: 503 },
      );
    }
    if (error) throw new Error('연결 정보를 저장하지 못했어요.');
    return NextResponse.json(connectionResponse(data as ConnectionRow));
  } catch (error) {
    const message = error instanceof Error ? error.message : '넥슨 API 키를 확인하지 못했어요.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { starforceDiscountRate?: unknown };
  const discountRate = Number(body.starforceDiscountRate);
  if (!VALID_DISCOUNT_RATES.has(discountRate)) {
    return NextResponse.json({ error: '지원하지 않는 할인율이에요.' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from('nexon_api_connections')
    .update({ starforce_discount_rate: discountRate, updated_at: new Date().toISOString() })
    .eq('user_id', session.user.id)
    .select('api_key_last4, nexon_ouid, starforce_discount_rate, connected_at, last_synced_at')
    .maybeSingle();

  if (error) return NextResponse.json({ error: '할인 설정을 저장하지 못했어요.' }, { status: 500 });
  if (!data) return NextResponse.json({ error: '먼저 넥슨 API 키를 연결해 주세요.' }, { status: 404 });
  return NextResponse.json(connectionResponse(data as ConnectionRow));
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const db = supabaseAdmin();
  const { error } = await db
    .from('nexon_api_connections')
    .delete()
    .eq('user_id', session.user.id);

  if (error) return NextResponse.json({ error: '넥슨 연결을 해제하지 못했어요.' }, { status: 500 });
  return NextResponse.json({ connected: false });
}
