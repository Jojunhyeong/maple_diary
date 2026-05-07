import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/shared/lib/supabase';

export const dynamic = 'force-dynamic';

type EquipmentCatalogRow = {
  id: string;
  slug: string;
  name: string;
  slot: string;
  part: string;
  job_group: string | null;
  level: number | null;
  icon_url: string | null;
  source_url: string | null;
  source: string;
};

function serializeDbError(error: { code?: string; message?: string; hint?: string; details?: string } | null | undefined) {
  return {
    code: error?.code,
    message: error?.message,
    hint: error?.hint,
    details: error?.details,
  };
}

function iconProxyUrl(slug: string, job?: string | null, characterClass?: string | null) {
  const params = new URLSearchParams();
  params.set('slug', slug);
  if (job) params.set('job', job);
  if (characterClass) params.set('class', characterClass);
  return `/api/equipment-catalog/icon?${params.toString()}`;
}

export async function GET(request: NextRequest) {
  const part = request.nextUrl.searchParams.get('part')?.trim();
  const job = request.nextUrl.searchParams.get('job')?.trim();
  const characterClass = request.nextUrl.searchParams.get('class')?.trim();
  const q = request.nextUrl.searchParams.get('q')?.trim();
  const limitValue = Number.parseInt(request.nextUrl.searchParams.get('limit') || '', 10);
  const limit = Number.isFinite(limitValue) ? Math.min(Math.max(limitValue, 1), 80) : 40;

  const db = supabaseAdmin();

  let query = db
    .from('equipment_catalog')
    .select('id, slug, name, slot, part, job_group, level, icon_url, source_url, source')
    .order('level', { ascending: true, nullsFirst: true })
    .order('name', { ascending: true });

  if (part) {
    query = query.eq('part', part);
  }

  if (q) {
    query = query.ilike('name', `%${q}%`);
  }

  if (job) {
    query = query.or(`job_group.is.null,job_group.eq.all,job_group.eq.${job}`);
  }

  const [itemsResult, partsResult] = await Promise.all([
    query.limit(limit),
    db.from('equipment_catalog').select('part').order('part', { ascending: true }),
  ]);

  if (itemsResult.error) {
    return NextResponse.json(
      { error: 'equipment catalog lookup failed', dbError: serializeDbError(itemsResult.error) },
      { status: 500 },
    );
  }

  if (partsResult.error) {
    return NextResponse.json(
      { error: 'equipment catalog lookup failed', dbError: serializeDbError(partsResult.error) },
      { status: 500 },
    );
  }

  const items = ((itemsResult.data ?? []) as EquipmentCatalogRow[]).map((row) => ({
    ...row,
    icon_url: iconProxyUrl(row.slug, row.job_group, characterClass),
  }));
  const parts = Array.from(new Set((partsResult.data ?? []).map((row) => row.part).filter(Boolean))) as string[];

  return NextResponse.json({ items, parts });
}
