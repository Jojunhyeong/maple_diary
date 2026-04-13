import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/../auth';
import { supabaseAdmin } from '@/shared/lib/supabase';
import {
  buildBossRevenueSnapshots,
  type ChecklistState,
  type BossCycleType,
} from '@/shared/lib/boss-checklist';

type BossRevenueBody = {
  weekKey?: string;
  monthKey?: string;
  characterId?: string | null;
  state?: ChecklistState;
};

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const start = req.nextUrl.searchParams.get('start');
  const end = req.nextUrl.searchParams.get('end');
  const weekKey = req.nextUrl.searchParams.get('weekKey');
  const cycleType = req.nextUrl.searchParams.get('cycleType') as BossCycleType | null;
  const characterId = req.nextUrl.searchParams.get('characterId');
  const db = supabaseAdmin();

  let query = db
    .from('boss_revenues')
    .select('*')
    .eq('user_id', session.user.id)
    .order('week_key', { ascending: false });

  if (weekKey) {
    query = query.eq('week_key', weekKey);
  } else if (start) {
    query = query.gte('week_key', start);
    if (end) query = query.lte('week_key', end);
  }

  if (cycleType) {
    query = query.eq('cycle_type', cycleType);
  }
  if (characterId) {
    query = query.eq('character_id', characterId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as BossRevenueBody;
  if (!body.weekKey || !body.monthKey || !body.state || !body.characterId) {
    return NextResponse.json({ error: 'weekKey, monthKey, characterId and state are required' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const snapshots = buildBossRevenueSnapshots(body.state, body.weekKey, body.monthKey, body.characterId);

  if (snapshots.length === 0) {
    return NextResponse.json({ error: 'Nothing to save' }, { status: 400 });
  }

  const savedCycles: BossCycleType[] = [];

  for (const snapshot of snapshots) {
    const { data: existing, error: existingError } = await db
      .from('boss_revenues')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('character_id', snapshot.characterId)
      .eq('cycle_type', snapshot.cycleType)
      .eq('week_key', snapshot.weekKey)
      .maybeSingle();

    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
    if (existing) continue;

    const { error } = await db
      .from('boss_revenues')
      .insert({
        user_id: session.user.id,
        character_id: snapshot.characterId,
        cycle_type: snapshot.cycleType,
        week_key: snapshot.weekKey,
        state: snapshot.state,
        total_revenue: snapshot.totalRevenue,
        selected_bosses: snapshot.selectedBosses,
        selected_clears: snapshot.selectedClears,
        by_category: snapshot.byCategory,
      });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    savedCycles.push(snapshot.cycleType);
  }

  if (savedCycles.length === 0) {
    return NextResponse.json({ error: 'Already saved' }, { status: 409 });
  }

  return NextResponse.json({ savedCycles });
}
