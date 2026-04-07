import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/../auth';
import { supabaseAdmin } from '@/shared/lib/supabase';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { records, goals } = await req.json();
  const db = supabaseAdmin();
  const userId = session.user.id;

  // records 마이그레이션
  if (records?.length > 0) {
    const rows = records.map((r: Record) => ({
      id: r.id,
      user_id: userId,
      date: r.date,
      time_minutes: r.time_minutes,
      meso: r.meso,
      shard_count: r.shard_count ?? 0,
      material_cost: r.material_cost ?? 0,
      shard_value: (r as any).shard_value ?? 0,
      total_revenue: (r as any).total_revenue ?? 0,
      net_revenue: (r as any).net_revenue ?? 0,
      meso_per_hour: (r as any).meso_per_hour ?? 0,
      net_per_hour: (r as any).net_per_hour ?? 0,
      shard_per_hour: (r as any).shard_per_hour ?? 0,
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
    const rows = goals.map((g: any) => ({
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
