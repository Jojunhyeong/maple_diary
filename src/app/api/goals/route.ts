import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/../auth';
import { supabaseAdmin } from '@/shared/lib/supabase';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const month = req.nextUrl.searchParams.get('month');
  const db = supabaseAdmin();

  const query = db.from('goals').select('*').eq('user_id', session.user.id);
  if (month) query.eq('month', month);

  const { data, error } = await query.single();
  if (error && error.code !== 'PGRST116') return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? null);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const db = supabaseAdmin();

  const { data, error } = await db
    .from('goals')
    .upsert({ ...body, user_id: session.user.id }, { onConflict: 'user_id,month' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
