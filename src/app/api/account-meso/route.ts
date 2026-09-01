import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/../auth';
import { supabaseAdmin } from '@/shared/lib/supabase';

export const dynamic = 'force-dynamic';

type AccountMesoRow = {
  amount: number;
  updated_at: string;
};

function isMissingTableError(error: { code?: string } | null) {
  return error?.code === '42P01' || error?.code === 'PGRST205';
}

function missingTableResponse() {
  return NextResponse.json(
    { error: '보유 메소용 DB 설정이 필요합니다. supabase_create_account_meso.sql을 실행해 주세요.' },
    { status: 503 },
  );
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin()
    .from('account_meso')
    .select('amount, updated_at')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (isMissingTableError(error)) return missingTableResponse();
  if (error) return NextResponse.json({ error: '보유 메소를 불러오지 못했어요.' }, { status: 500 });

  const row = data as AccountMesoRow | null;
  return NextResponse.json({
    amount: row?.amount ?? 0,
    updatedAt: row?.updated_at ?? null,
  });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { amount?: unknown };
  const amount = Number(body.amount);
  if (!Number.isSafeInteger(amount) || amount < 0) {
    return NextResponse.json({ error: '보유 메소는 0 이상의 정수로 입력해 주세요.' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin()
    .from('account_meso')
    .upsert(
      { user_id: session.user.id, amount, updated_at: now },
      { onConflict: 'user_id' },
    )
    .select('amount, updated_at')
    .single();

  if (isMissingTableError(error)) return missingTableResponse();
  if (error) return NextResponse.json({ error: '보유 메소를 저장하지 못했어요.' }, { status: 500 });

  const row = data as AccountMesoRow;
  return NextResponse.json({ amount: row.amount, updatedAt: row.updated_at });
}
