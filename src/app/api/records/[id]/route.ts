import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/../auth';
import { supabaseAdmin } from '@/shared/lib/supabase';
import { resolveOwnedCharacterId } from '@/shared/lib/server/owned-character';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const db = supabaseAdmin();

  const { error } = await db
    .from('records')
    .delete()
    .eq('id', id)
    .eq('user_id', session.user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const payload = { ...(body ?? {}) };
  for (const protectedField of [
    'id',
    'user_id',
    'local_owner_id',
    'created_at',
    'updated_at',
    'sync_status',
  ]) {
    delete payload[protectedField];
  }

  const db = supabaseAdmin();
  if ('character_id' in payload) {
    const characterId = await resolveOwnedCharacterId(
      db,
      session.user.id,
      payload.character_id as string | null | undefined,
    ).catch(() => null);
    if (!characterId) {
      return NextResponse.json({ error: '저장할 캐릭터를 찾지 못했어요.' }, { status: 400 });
    }
    payload.character_id = characterId;
  }

  const { data, error } = await db
    .from('records')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', session.user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
