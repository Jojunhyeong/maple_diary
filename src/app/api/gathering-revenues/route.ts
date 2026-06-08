import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/../auth';
import { supabaseAdmin } from '@/shared/lib/supabase';
import { normalizeGatheringItemTab } from '@/shared/lib/gathering-revenue';

type GatheringRevenueEntryBody = {
  itemName?: string;
  itemTab?: string;
  quantity?: number;
  unitPrice?: number;
};

type GatheringRevenueBody = {
  date?: string;
  characterId?: string | null;
  entries?: GatheringRevenueEntryBody[];
};

function serializeDbError(error: { code?: string; message?: string; hint?: string; details?: string } | null | undefined) {
  return {
    code: error?.code,
    message: error?.message,
    hint: error?.hint,
    details: error?.details,
  };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const start = req.nextUrl.searchParams.get('start');
  const end = req.nextUrl.searchParams.get('end');
  const characterId = req.nextUrl.searchParams.get('characterId');
  const db = supabaseAdmin();

  let query = db
    .from('gathering_revenues')
    .select('*')
    .eq('user_id', session.user.id)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  if (start) query = query.gte('date', start);
  if (end) query = query.lte('date', end);
  if (characterId) query = query.eq('character_id', characterId);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: 'gathering revenue load failed', dbError: serializeDbError(error) },
      { status: 500 },
    );
  }

  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as GatheringRevenueBody;
  if (!body.date || !body.characterId || !Array.isArray(body.entries) || body.entries.length === 0) {
    return NextResponse.json(
      { error: 'date, characterId and entries are required' },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const rows = body.entries
    .map((entry) => {
      const itemName = typeof entry.itemName === 'string' ? entry.itemName.trim() : '';
      const quantity = Math.max(0, Math.floor(Number(entry.quantity) || 0));
      const unitPrice = Math.max(0, Math.floor(Number(entry.unitPrice) || 0));
      if (!itemName || quantity <= 0 || unitPrice <= 0) return null;

      return {
        user_id: session.user.id,
        character_id: body.characterId,
        date: body.date,
        item_name: itemName,
        item_tab: normalizeGatheringItemTab(entry.itemTab || 'seed'),
        quantity,
        unit_price: unitPrice,
        total_amount: quantity * unitPrice,
        created_at: now,
        updated_at: now,
      };
    })
    .filter((row): row is NonNullable<typeof row> => !!row);

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Nothing to save' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from('gathering_revenues')
    .insert(rows)
    .select('*');

  if (error) {
    return NextResponse.json(
      { error: 'gathering revenue save failed', dbError: serializeDbError(error) },
      { status: 500 },
    );
  }

  return NextResponse.json(data ?? []);
}
