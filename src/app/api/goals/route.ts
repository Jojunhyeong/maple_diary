import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/../auth';
import { supabaseAdmin } from '@/shared/lib/supabase';
import type { Goal, GoalTarget } from '@/shared/types';

type GoalRow = Goal & {
  user_id: string;
  targets?: GoalTarget[] | null;
};

function serializeDbError(error: { code?: string; message?: string; hint?: string; details?: string } | null | undefined) {
  return {
    code: error?.code,
    message: error?.message,
    hint: error?.hint,
    details: error?.details,
  };
}

function normalizeGoalGoal(goal: Goal): GoalRow {
  const targets = Array.isArray(goal.targets) ? goal.targets : [];
  const { local_owner_id: _localOwnerId, month: _month, ...rest } = goal;
  void _localOwnerId;
  void _month;
  return {
    ...rest,
    user_id: goal.user_id ?? '',
    targets,
  };
}

function normalizeGoalsPayload(body: unknown): Goal[] {
  if (!body || typeof body !== 'object') return [];
  const payload = body as Record<string, unknown>;
  if (Array.isArray(payload.goals)) return payload.goals as Goal[];
  if (payload.goal && typeof payload.goal === 'object') return [payload.goal as Goal];
  return [];
}

function isMissingColumnError(error: { code?: string; message?: string } | null | undefined, column: string) {
  const message = error?.message?.toLowerCase() ?? '';
  return error?.code === '42703' && message.includes(column.toLowerCase());
}

function isUniqueUserGoalError(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? '';
  return error?.code === '23505' && message.includes('user_id');
}

async function fetchUserGoals(db: ReturnType<typeof supabaseAdmin>, userId: string) {
  const baseQuery = db.from('goals').select('*').eq('user_id', userId);
  let { data, error } = await baseQuery.order('position', { ascending: true }).order('created_at', { ascending: false });

  if (error && isMissingColumnError(error, 'position')) {
    ({ data, error } = await baseQuery.order('created_at', { ascending: false }));
  }

  if (error) return { data: null as GoalRow[] | null, error };
  return { data: (data ?? []) as GoalRow[], error: null };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = supabaseAdmin();
  const { data, error } = await fetchUserGoals(db, session.user.id);

  if (error) {
    return NextResponse.json(
      { error: 'goal lookup failed', dbError: serializeDbError(error) },
      { status: 500 },
    );
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const incomingGoals = normalizeGoalsPayload(body);
  const db = supabaseAdmin();

  const { data: existingGoals, error: lookupError } = await fetchUserGoals(db, session.user.id);
  if (lookupError) {
    return NextResponse.json(
      { error: 'goal lookup failed', dbError: serializeDbError(lookupError) },
      { status: 500 },
    );
  }

  const normalizedGoals: GoalRow[] = incomingGoals.map((goal) => {
    const normalized = normalizeGoalGoal(goal);
    return {
      ...normalized,
      id: normalized.id || crypto.randomUUID(),
      user_id: session.user.id,
      position: normalized.position ?? 0,
      created_at: normalized.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      targets: normalized.targets?.length ? normalized.targets : normalized.targets ?? [],
    };
  });

  const incomingIds = new Set(normalizedGoals.map((goal) => goal.id));

  if (normalizedGoals.length === 0) {
    const { error } = await db.from('goals').delete().eq('user_id', session.user.id);
    if (error) {
      return NextResponse.json(
        { error: 'goal delete failed', dbError: serializeDbError(error) },
        { status: 500 },
      );
    }
    return NextResponse.json([]);
  }

  let { error: upsertError } = await db.from('goals').upsert(normalizedGoals, { onConflict: 'id' });
  if (upsertError && isMissingColumnError(upsertError, 'position')) {
    const withoutPosition = normalizedGoals.map((goal) => {
      const { position, ...row } = goal;
      void position;
      return row;
    });
    ({ error: upsertError } = await db.from('goals').upsert(withoutPosition, { onConflict: 'id' }));
  }

  if (upsertError) {
    const message = isUniqueUserGoalError(upsertError)
      ? 'goals 테이블에 user_id 유니크 인덱스가 남아 있어요. supabase_alter_goals_add_targets.sql을 다시 실행해 주세요.'
      : 'goal save failed';
    return NextResponse.json(
      { error: message, dbError: serializeDbError(upsertError) },
      { status: 500 },
    );
  }

  const staleIds = (existingGoals ?? [])
    .map((goal) => goal.id)
    .filter((id) => !incomingIds.has(id));

  if (staleIds.length > 0) {
    const { error: deleteError } = await db
      .from('goals')
      .delete()
      .eq('user_id', session.user.id)
      .in('id', staleIds);

    if (deleteError) {
      return NextResponse.json(
        { error: 'goal cleanup failed', dbError: serializeDbError(deleteError) },
        { status: 500 },
      );
    }
  }

  const { data: refreshed, error: refreshError } = await fetchUserGoals(db, session.user.id);
  if (refreshError) {
    return NextResponse.json(
      { error: 'goal lookup failed', dbError: serializeDbError(refreshError) },
      { status: 500 },
    );
  }

  return NextResponse.json(refreshed);
}
