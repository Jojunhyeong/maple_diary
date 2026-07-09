import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/../auth';
import { supabaseAdmin } from '@/shared/lib/supabase';

function serializeDbError(error: { code?: string; message?: string; hint?: string; details?: string } | null | undefined) {
  return {
    code: error?.code,
    message: error?.message,
    hint: error?.hint,
    details: error?.details,
  };
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const db = supabaseAdmin();
  const { error } = await db
    .from('gathering_revenues')
    .delete()
    .eq('id', id)
    .eq('user_id', session.user.id);

  if (error) {
    return NextResponse.json(
      { error: 'gathering revenue delete failed', dbError: serializeDbError(error) },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
