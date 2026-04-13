import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";
import { supabaseAdmin } from "@/shared/lib/supabase";
import type { CharacterProfile } from "@/shared/types";
import { isUuidLike, type LocalCharacterProfile } from "@/shared/lib/character-storage";

interface MigratePayload {
  profile?: LocalCharacterProfile | null;
  characters?: LocalCharacterProfile[];
  activeCharacterId?: string | null;
}

function normalizeCharacter(
  character: LocalCharacterProfile,
  fallbackIsActive: boolean,
): CharacterProfile {
  const now = new Date().toISOString();

  return {
    id: isUuidLike(character.id) ? character.id : crypto.randomUUID(),
    character_name: character.character_name || "Unknown",
    character_ocid: character.character_ocid,
    class: character.character_class || "Unknown",
    level: character.character_level || 1,
    image_url: character.image_url,
    character_world: character.character_world ?? null,
    character_exp_rate: character.character_exp_rate ?? null,
    character_combat_power: character.character_combat_power ?? null,
    is_active: character.is_active ?? fallbackIsActive,
    source: "legacy_profile",
    created_at: character.profile_set_at || now,
    updated_at: now,
  };
}

async function upsertCharacterForUser(
  db: ReturnType<typeof supabaseAdmin>,
  userId: string,
  character: CharacterProfile,
) {
  const lookup = db
    .from("characters")
    .select("id")
    .eq("user_id", userId);

  const matched = character.character_ocid
    ? await lookup.eq("character_ocid", character.character_ocid).maybeSingle()
    : await lookup.eq("character_name", character.character_name).maybeSingle();

  const row = {
    id: matched.data?.id || character.id,
    user_id: userId,
    character_name: character.character_name,
    character_ocid: character.character_ocid ?? null,
    class: character.class,
    level: character.level,
    image_url: character.image_url ?? null,
    character_world: character.character_world ?? null,
    character_exp_rate: character.character_exp_rate ?? null,
    character_combat_power: character.character_combat_power ?? null,
    is_active: character.is_active ?? false,
    created_at: character.created_at,
    updated_at: character.updated_at,
  };

  if (matched.data?.id) {
    const { error } = await db
      .from("characters")
      .update(row)
      .eq("id", matched.data.id);

    if (error) {
      throw error;
    }

    return matched.data.id;
  }

  const { error, data } = await db
    .from("characters")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data.id as string;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await req.json().catch(() => ({}))) as MigratePayload;
  const db = supabaseAdmin();
  const userId = session.user.id;

  const incoming = Array.isArray(payload.characters) && payload.characters.length > 0
    ? payload.characters
    : payload.profile
      ? [payload.profile]
      : [];

  if (incoming.length === 0) {
    return NextResponse.json({ ok: true, migratedCharacters: 0 });
  }

  const normalized = incoming.map((character, index) => {
    const isActive = payload.activeCharacterId
      ? character.id === payload.activeCharacterId ||
        character.character_ocid === payload.activeCharacterId ||
        character.character_name === payload.activeCharacterId
      : index === 0;

    return normalizeCharacter(character, isActive);
  });

  const savedIds: string[] = [];
  for (const character of normalized) {
    const savedId = await upsertCharacterForUser(db, userId, character);
    savedIds.push(savedId);
  }

  const activeCharacter =
    normalized.find((character) => character.is_active) || normalized[0];
  const activeIndex = activeCharacter ? normalized.findIndex((character) => character.id === activeCharacter.id) : -1;
  const activeSavedId = activeIndex >= 0 ? savedIds[activeIndex] : savedIds[0];

  if (activeCharacter) {
    await db
      .from("characters")
      .update({ is_active: false })
      .eq("user_id", userId);

    await db
      .from("characters")
      .update({ is_active: true })
      .eq("id", activeSavedId || activeCharacter.id);

    await db
      .from("users")
      .update({
        character_name: activeCharacter.character_name,
        character_ocid: activeCharacter.character_ocid ?? null,
        character_class: activeCharacter.class,
        character_level: activeCharacter.level,
        character_image: activeCharacter.image_url ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    await db
      .from("records")
      .update({ character_id: activeSavedId || activeCharacter.id })
      .eq("user_id", userId)
      .is("character_id", null);
  }

  return NextResponse.json({
    ok: true,
    migratedCharacters: savedIds.length,
    activeCharacterId: activeSavedId || activeCharacter?.id || null,
  });
}
