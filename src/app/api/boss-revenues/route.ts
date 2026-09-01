import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/../auth';
import { supabaseAdmin } from '@/shared/lib/supabase';
import { resolveOwnedCharacterId } from '@/shared/lib/server/owned-character';
import { BOSS_CATALOG } from '@/shared/data/boss-catalog';
import {
  buildBossRevenueSnapshots,
  isBossSelected,
  type ChecklistState,
  type BossCycleType,
} from '@/shared/lib/boss-checklist';

type BossRevenueBody = {
  weekKey?: string;
  monthKey?: string;
  characterId?: string | null;
  state?: ChecklistState;
};

function isMissingBossSchemaError(error: { message?: string; code?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? '';
  return (
    error?.code === '42703' ||
    message.includes('column') && message.includes('does not exist') ||
    message.includes('boss_revenues') && (message.includes('character_id') || message.includes('cycle_type'))
  );
}

function serializeDbError(error: { code?: string; message?: string; hint?: string; details?: string } | null | undefined) {
  return {
    code: error?.code,
    message: error?.message,
    hint: error?.hint,
    details: error?.details,
  };
}

function attachBossMeta(
  state: ChecklistState,
  cycleType: BossCycleType,
  characterId: string | null,
) {
  return {
    ...state,
    __bossMeta: {
      cycleType,
      characterId,
    },
  };
}

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

  const { data: characters, error: charactersError } = await db
    .from('characters')
    .select('id')
    .eq('user_id', session.user.id);

  if (charactersError) {
    return NextResponse.json({ error: charactersError.message }, { status: 500 });
  }

  const activeCharacterIds = new Set((characters ?? []).map((character) => character.id).filter((id): id is string => !!id));

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

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const filtered = (data ?? []).filter((row) => {
    const state = row.state as ChecklistState & {
      __bossMeta?: { cycleType?: BossCycleType; characterId?: string | null };
    };
    const rowCycleType = row.cycle_type ?? state?.__bossMeta?.cycleType;
    const rowCharacterId = row.character_id ?? state?.__bossMeta?.characterId ?? null;
    if (cycleType && rowCycleType !== cycleType) return false;
    if (characterId && rowCharacterId !== characterId) return false;
    if (rowCharacterId && !activeCharacterIds.has(rowCharacterId)) return false;
    return true;
  });

  return NextResponse.json(filtered);
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
  const characterId = await resolveOwnedCharacterId(
    db,
    session.user.id,
    body.characterId,
  ).catch(() => null);
  if (!characterId) {
    return NextResponse.json({ error: '저장할 캐릭터를 찾지 못했어요.' }, { status: 400 });
  }

  const selectedAccountWideBosses = BOSS_CATALOG
    .flatMap((group) => group.bosses)
    .filter((boss) => boss.accountWide && isBossSelected(body.state, boss.id));

  if (selectedAccountWideBosses.length > 0) {
    const { data: existingRows, error: accountBossLookupError } = await db
      .from('boss_revenues')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('week_key', body.weekKey);

    if (accountBossLookupError) {
      return NextResponse.json(
        { error: 'account-wide boss lookup failed', dbError: serializeDbError(accountBossLookupError) },
        { status: 500 },
      );
    }

    for (const boss of selectedAccountWideBosses) {
      const duplicate = (existingRows ?? []).find((row) => {
        const rowState = row.state as ChecklistState & {
          __bossMeta?: { cycleType?: BossCycleType; characterId?: string | null };
        };
        const rowCycleType = row.cycle_type ?? rowState?.__bossMeta?.cycleType;
        const rowCharacterId = row.character_id ?? rowState?.__bossMeta?.characterId ?? null;
        return rowCycleType === 'weekly' && rowCharacterId !== characterId && isBossSelected(rowState, boss.id);
      });

      if (duplicate) {
        return NextResponse.json(
          { error: `${boss.name}은 메이플ID당 주 1회만 기록할 수 있어요` },
          { status: 409 },
        );
      }
    }
  }

  const snapshots = buildBossRevenueSnapshots(body.state, body.weekKey, body.monthKey, characterId);

  if (snapshots.length === 0) {
    return NextResponse.json({ error: 'Nothing to save' }, { status: 400 });
  }

  const savedCycles: BossCycleType[] = [];

  for (const snapshot of snapshots) {
    const currentPayload = {
      user_id: session.user.id,
      character_id: snapshot.characterId,
      cycle_type: snapshot.cycleType,
      week_key: snapshot.weekKey,
      state: snapshot.state,
      total_revenue: snapshot.totalRevenue,
      selected_bosses: snapshot.selectedBosses,
      selected_clears: snapshot.selectedClears,
      by_category: snapshot.byCategory,
    };

    const { error: modernError } = await db
      .from('boss_revenues')
      .upsert(currentPayload, {
        onConflict: 'user_id,character_id,cycle_type,week_key',
      });

    if (!modernError) {
      savedCycles.push(snapshot.cycleType);
      continue;
    }

    if (!isMissingBossSchemaError(modernError)) {
      return NextResponse.json(
        { error: 'boss revenue save failed', dbError: serializeDbError(modernError) },
        { status: 500 },
      );
    }

    const legacyPayload = {
      user_id: session.user.id,
      week_key: snapshot.weekKey,
      state: attachBossMeta(snapshot.state, snapshot.cycleType, snapshot.characterId),
      total_revenue: snapshot.totalRevenue,
      selected_bosses: snapshot.selectedBosses,
      selected_clears: snapshot.selectedClears,
      by_category: snapshot.byCategory,
    };

    const { error: legacyError } = await db.from('boss_revenues').insert(legacyPayload);

    if (legacyError) {
      return NextResponse.json(
        { error: 'legacy boss revenue save failed', dbError: serializeDbError(legacyError) },
        { status: 500 },
      );
    }
    savedCycles.push(snapshot.cycleType);
  }

  if (savedCycles.length === 0) {
    return NextResponse.json({ error: 'Already saved' }, { status: 409 });
  }

  return NextResponse.json({ savedCycles });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const weekKey = req.nextUrl.searchParams.get('weekKey');
  const monthKey = req.nextUrl.searchParams.get('monthKey');
  const characterId = req.nextUrl.searchParams.get('characterId');

  if (!characterId || (!weekKey && !monthKey)) {
    return NextResponse.json({ error: 'characterId and at least one period key are required' }, { status: 400 });
  }

  const db = supabaseAdmin();
  let query = db
    .from('boss_revenues')
    .select('id, character_id, cycle_type, week_key, state')
    .eq('user_id', session.user.id)
    .eq('character_id', characterId);

  const keys = [weekKey, monthKey].filter((value): value is string => !!value);
  if (keys.length === 1) {
    query = query.eq('week_key', keys[0]);
  } else if (keys.length > 1) {
    query = query.in('week_key', keys);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: 'boss revenue lookup failed', dbError: serializeDbError(error) },
      { status: 500 },
    );
  }

  const targetRows = (data ?? []).filter((row) => {
    const state = row.state as ChecklistState & {
      __bossMeta?: { cycleType?: BossCycleType; characterId?: string | null };
    };
    const rowCycleType = row.cycle_type ?? state?.__bossMeta?.cycleType;
    const rowCharacterId = row.character_id ?? state?.__bossMeta?.characterId ?? null;
    const matchesCharacter = rowCharacterId === characterId;
    const matchesKey = [weekKey, monthKey].filter(Boolean).includes(row.week_key);
    return matchesCharacter && matchesKey && (!!rowCycleType || rowCycleType === undefined);
  });

  if (targetRows.length === 0) {
    return NextResponse.json({ deletedCycles: [] });
  }

  const ids = targetRows.map((row) => row.id);
  const { error: deleteError } = await db.from('boss_revenues').delete().in('id', ids);

  if (deleteError) {
    return NextResponse.json(
      { error: 'boss revenue delete failed', dbError: serializeDbError(deleteError) },
      { status: 500 },
    );
  }

  return NextResponse.json({ deletedCycles: targetRows.map((row) => row.cycle_type ?? row.state?.__bossMeta?.cycleType).filter(Boolean) });
}
