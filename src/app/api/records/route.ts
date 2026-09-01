import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/../auth';
import { supabaseAdmin } from '@/shared/lib/supabase';
import { resolveOwnedCharacterId } from '@/shared/lib/server/owned-character';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from('records')
    .select('*')
    .eq('user_id', session.user.id)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const db = supabaseAdmin();
  const characterId = await resolveOwnedCharacterId(
    db,
    session.user.id,
    body?.character_id,
  ).catch(() => null);

  if (!characterId) {
    return NextResponse.json({ error: '저장할 캐릭터를 찾지 못했어요.' }, { status: 400 });
  }

  const { data, error } = await db
    .from('records')
    .insert({ ...body, user_id: session.user.id, character_id: characterId })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
