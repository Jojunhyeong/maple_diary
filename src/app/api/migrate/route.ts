import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/../auth';
import { supabaseAdmin } from '@/shared/lib/supabase';
import type { Goal, Record as DiaryRecord, RecordWithCalculations } from '@/shared/types';

type MigratableRecord = DiaryRecord & Partial<
  Pick<
    RecordWithCalculations,
    'shard_value' | 'total_revenue' | 'net_revenue' | 'meso_per_hour' | 'net_per_hour' | 'shard_per_hour'
  >
>;

interface MigratePayload {
  records?: MigratableRecord[];
  goals?: Goal[];
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { records, goals } = (await req.json()) as MigratePayload;
  const db = supabaseAdmin();
  const userId = session.user.id;

  // records 마이그레이션
  if (records?.length > 0) {
    const rows = records.map((r) => ({
      id: r.id,
      user_id: userId,
      date: r.date,
      time_minutes: r.time_minutes,
      meso: r.meso,
      shard_count: r.shard_count ?? 0,
      material_cost: r.material_cost ?? 0,
      shard_value: r.shard_value ?? 0,
      total_revenue: r.total_revenue ?? 0,
      net_revenue: r.net_revenue ?? 0,
      meso_per_hour: r.meso_per_hour ?? 0,
      net_per_hour: r.net_per_hour ?? 0,
      shard_per_hour: r.shard_per_hour ?? 0,
      memo: r.memo ?? null,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));

    const { error } = await db
      .from('records')
      .upsert(rows, { onConflict: 'id' });

    if (error) {
      console.error('records migrate error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // goals 마이그레이션
  if (goals?.length > 0) {
    const rows = goals.map((g) => ({
      id: g.id,
      user_id: userId,
      month: g.month,
      meso_goal: g.meso_goal ?? null,
      shard_goal: g.shard_goal ?? null,
      created_at: g.created_at,
      updated_at: g.updated_at,
    }));

    const { error } = await db
      .from('goals')
      .upsert(rows, { onConflict: 'id' });

    if (error) {
      console.error('goals migrate error:', error);
    }
  }

  return NextResponse.json({ ok: true, migratedRecords: records?.length ?? 0 });
}
