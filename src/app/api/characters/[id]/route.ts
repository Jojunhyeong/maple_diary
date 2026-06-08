import { NextResponse } from 'next/server';
import { auth } from '@/../auth';
import { supabaseAdmin } from '@/shared/lib/supabase';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const db = supabaseAdmin();
  const payload = await req.json().catch(() => ({})) as {
    characterName?: string;
    characterOcid?: string | null;
  };

  const lookupCandidates = async () => {
    const byId = await db
      .from('characters')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('id', id)
      .maybeSingle();

    if (byId.error) {
      return { error: byId.error.message, candidateIds: [] as string[] };
    }

    const candidateIds = new Set<string>();
    if (byId.data?.id) {
      candidateIds.add(byId.data.id);
    }

    if (payload.characterOcid) {
      const { data, error } = await db
        .from('characters')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('character_ocid', payload.characterOcid);
      if (error) return { error: error.message, candidateIds: [] as string[] };
      (data ?? []).forEach((character) => {
        if (character.id) candidateIds.add(character.id);
      });
    }

    if (payload.characterName) {
      const { data, error } = await db
        .from('characters')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('character_name', payload.characterName);
      if (error) return { error: error.message, candidateIds: [] as string[] };
      (data ?? []).forEach((character) => {
        if (character.id) candidateIds.add(character.id);
      });
    }

    return { candidateIds: [...candidateIds], error: null as string | null };
  };

  const { candidateIds, error: lookupCandidatesError } = await lookupCandidates();
  if (lookupCandidatesError) {
    return NextResponse.json({ error: lookupCandidatesError }, { status: 500 });
  }

  if (candidateIds.length === 0) {
    return NextResponse.json({ ok: true, deleted: 0 });
  }

  const { data: bossRevenueRows, error: bossRevenuesLookupError } = await db
    .from('boss_revenues')
    .select('id, character_id, state')
    .eq('user_id', session.user.id);

  if (bossRevenuesLookupError) {
    return NextResponse.json({ error: bossRevenuesLookupError.message }, { status: 500 });
  }

  const bossRevenueIds = (bossRevenueRows ?? [])
    .filter((row) => {
      const state = row.state as {
        __bossMeta?: { characterId?: string | null };
      } | null;
      const metaCharacterId = state?.__bossMeta?.characterId ?? null;
      return candidateIds.includes(row.character_id ?? '') || candidateIds.includes(metaCharacterId ?? '');
    })
    .map((row) => row.id)
    .filter((value): value is string => !!value);

  if (bossRevenueIds.length > 0) {
    const { error: bossRevenuesError } = await db
      .from('boss_revenues')
      .delete()
      .in('id', bossRevenueIds);

    if (bossRevenuesError) {
      return NextResponse.json({ error: bossRevenuesError.message }, { status: 500 });
    }
  }

  const { data: recordRows, error: recordsLookupError } = await db
    .from('records')
    .select('id, character_id')
    .eq('user_id', session.user.id);

  if (recordsLookupError) {
    return NextResponse.json({ error: recordsLookupError.message }, { status: 500 });
  }

  const recordIds = (recordRows ?? [])
    .filter((row) => candidateIds.includes(row.character_id ?? ''))
    .map((row) => row.id)
    .filter((value): value is string => !!value);

  if (recordIds.length > 0) {
    const { error: recordsError } = await db
      .from('records')
      .delete()
      .in('id', recordIds);

    if (recordsError) {
      return NextResponse.json({ error: recordsError.message }, { status: 500 });
    }
  }

  const { error } = await db
    .from('characters')
    .delete()
    .in('id', candidateIds)
    .eq('user_id', session.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deleted: candidateIds.length });
}
