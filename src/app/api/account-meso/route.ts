import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/../auth';
import { supabaseAdmin } from '@/shared/lib/supabase';

export const dynamic = 'force-dynamic';

type AccountMesoRow = {
  amount: number;
  updated_at: string;
};

type AccountMesoHistoryRow = {
  id: string;
  amount_before: number;
  amount_after: number;
  delta: number;
  entry_type: string;
  source_id: string | null;
  note: string | null;
  created_at: string;
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

  const db = supabaseAdmin();
  const [{ data, error }, historyResult] = await Promise.all([
    db
    .from('account_meso')
    .select('amount, updated_at')
    .eq('user_id', session.user.id)
    .maybeSingle(),
    db
      .from('account_meso_history')
      .select('id, amount_before, amount_after, delta, entry_type, source_id, note, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  if (isMissingTableError(error) || isMissingTableError(historyResult.error)) return missingTableResponse();
  if (error || historyResult.error) return NextResponse.json({ error: '보유 메소를 불러오지 못했어요.' }, { status: 500 });

  const row = data as AccountMesoRow | null;
  return NextResponse.json({
    amount: row?.amount ?? 0,
    updatedAt: row?.updated_at ?? null,
    history: ((historyResult.data ?? []) as AccountMesoHistoryRow[]).map((entry) => ({
      id: entry.id,
      amountBefore: entry.amount_before,
      amountAfter: entry.amount_after,
      delta: entry.delta,
      entryType: entry.entry_type,
      sourceId: entry.source_id,
      note: entry.note,
      createdAt: entry.created_at,
    })),
  });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { amount?: unknown; note?: unknown };
  const amount = Number(body.amount);
  if (!Number.isSafeInteger(amount) || amount < 0) {
    return NextResponse.json({ error: '보유 메소는 0 이상의 정수로 입력해 주세요.' }, { status: 400 });
  }

  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 200) : null;
  const db = supabaseAdmin();
  const { data, error } = await db.rpc('set_account_meso_balance', {
    p_user_id: session.user.id,
    p_amount: amount,
    p_note: note || null,
  }).single();

  if (isMissingTableError(error)) return missingTableResponse();
  if (error?.code === '42883' || error?.message?.includes('set_account_meso_balance')) {
    return missingTableResponse();
  }
  if (error) return NextResponse.json({ error: '보유 메소를 저장하지 못했어요.' }, { status: 500 });

  const row = data as AccountMesoRow;
  const { data: history, error: historyError } = await db
    .from('account_meso_history')
    .select('id, amount_before, amount_after, delta, entry_type, source_id, note, created_at')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(100);
  if (historyError) return NextResponse.json({ error: '잔액 조정 이력을 불러오지 못했어요.' }, { status: 500 });
  return NextResponse.json({
    amount: row.amount,
    updatedAt: row.updated_at,
    history: ((history ?? []) as AccountMesoHistoryRow[]).map((entry) => ({
      id: entry.id,
      amountBefore: entry.amount_before,
      amountAfter: entry.amount_after,
      delta: entry.delta,
      entryType: entry.entry_type,
      sourceId: entry.source_id,
      note: entry.note,
      createdAt: entry.created_at,
    })),
  });
}
