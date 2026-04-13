import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/../auth';
import { supabaseAdmin } from '@/shared/lib/supabase';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { characterId } = await req.json().catch(() => ({}));
  if (typeof characterId !== 'string' || !characterId) {
    return NextResponse.json({ error: 'characterId is required' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { error } = await db
    .from('records')
    .update({ character_id: characterId })
    .eq('user_id', session.user.id)
    .is('character_id', null)
    .select('id');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
