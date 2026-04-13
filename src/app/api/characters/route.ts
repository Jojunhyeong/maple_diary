import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";
import { supabaseAdmin } from "@/shared/lib/supabase";
import { isUuidLike, type LocalCharacterProfile } from "@/shared/lib/character-storage";

function normalizeInput(input: LocalCharacterProfile) {
  return {
    id: isUuidLike(input.id) ? input.id : crypto.randomUUID(),
    character_name: input.character_name || "Unknown",
    character_ocid: input.character_ocid ?? null,
    class: input.character_class || "Unknown",
    level: input.character_level || 1,
    image_url: input.image_url ?? null,
    character_world: input.character_world ?? null,
    character_exp_rate: input.character_exp_rate ?? null,
    character_combat_power: input.character_combat_power ?? null,
    is_active: input.is_active ?? false,
    created_at: input.profile_set_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("characters")
    .select("*")
    .eq("user_id", session.user.id)
    .order("is_active", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const activeCharacter = data?.find((character) => character.is_active) ?? data?.[0] ?? null;
  return NextResponse.json({
    characters: data ?? [],
    activeCharacter,
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as LocalCharacterProfile;
  const db = supabaseAdmin();
  const row = normalizeInput(body);

  let existingQuery = db
    .from("characters")
    .select("id")
    .eq("user_id", session.user.id);

  if (row.character_ocid) {
    existingQuery = existingQuery.eq("character_ocid", row.character_ocid);
  } else {
    existingQuery = existingQuery.eq("character_name", row.character_name);
  }

  const { data: existing } = await existingQuery.maybeSingle();

  const savedRow = {
    user_id: session.user.id,
    character_name: row.character_name,
    character_ocid: row.character_ocid,
    class: row.class,
    level: row.level,
    image_url: row.image_url,
    character_world: row.character_world,
    character_exp_rate: row.character_exp_rate,
    character_combat_power: row.character_combat_power,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };

  let characterId = existing?.id ?? row.id;

  if (existing?.id) {
    const { error } = await db
      .from("characters")
      .update(savedRow)
      .eq("id", existing.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { data, error } = await db
      .from("characters")
      .insert({ id: row.id, ...savedRow })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    characterId = data.id as string;
  }

  if (row.is_active) {
    await db
      .from("characters")
      .update({ is_active: false })
      .eq("user_id", session.user.id);

    await db
      .from("characters")
      .update({ is_active: true })
      .eq("id", characterId);
  }

  return NextResponse.json({ ok: true, characterId });
}
