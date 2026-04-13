export const CHARACTER_STORAGE_KEYS = {
  LEGACY_PROFILE: "maple_diary:user_profile",
  CHARACTERS: "maple_diary:characters",
  ACTIVE_CHARACTER_ID: "maple_diary:active_character_id",
} as const;

export const CHARACTER_CHANGE_EVENT = "maple_diary:characters-changed";

export interface LocalCharacterProfile {
  id?: string;
  character_name: string;
  character_ocid?: string | null;
  character_world?: string | null;
  character_class: string;
  character_level: number;
  character_exp_rate?: number | string | null;
  character_combat_power?: number | null;
  image_url?: string | null;
  profile_set_at: string;
  is_active?: boolean;
}

export function isUuidLike(value: string | null | undefined): value is string {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function normalizeLocalCharacterProfile(profile: LocalCharacterProfile): LocalCharacterProfile & { id: string } {
  const id = isUuidLike(profile.id) ? profile.id : crypto.randomUUID();
  return {
    ...profile,
    id,
  };
}

export function normalizeLocalCharacterProfiles(characters: LocalCharacterProfile[]): Array<LocalCharacterProfile & { id: string }> {
  return characters.map((character) => normalizeLocalCharacterProfile(character));
}

export function readLegacyProfile(): LocalCharacterProfile | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(CHARACTER_STORAGE_KEYS.LEGACY_PROFILE);
    return raw ? (JSON.parse(raw) as LocalCharacterProfile) : null;
  } catch {
    return null;
  }
}

export function readLocalCharacters(): LocalCharacterProfile[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(CHARACTER_STORAGE_KEYS.CHARACTERS);
    if (raw) {
      const parsed = JSON.parse(raw) as LocalCharacterProfile[];
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => item && typeof item.character_name === "string");
      }
    }
  } catch {
    // ignore and fall back to the legacy profile below
  }

  const legacy = readLegacyProfile();
  return legacy ? [legacy] : [];
}

export function readActiveCharacterId(): string | null {
  if (typeof window === "undefined") return null;

  try {
    return localStorage.getItem(CHARACTER_STORAGE_KEYS.ACTIVE_CHARACTER_ID);
  } catch {
    return null;
  }
}

export function writeLocalCharacters(characters: LocalCharacterProfile[], activeId?: string | null) {
  if (typeof window === "undefined") return;

  localStorage.setItem(CHARACTER_STORAGE_KEYS.CHARACTERS, JSON.stringify(characters));

  if (activeId) {
    localStorage.setItem(CHARACTER_STORAGE_KEYS.ACTIVE_CHARACTER_ID, activeId);
  } else {
    localStorage.removeItem(CHARACTER_STORAGE_KEYS.ACTIVE_CHARACTER_ID);
  }

  window.dispatchEvent(new Event(CHARACTER_CHANGE_EVENT));
}

export function clearCharacterSelection() {
  if (typeof window === "undefined") return;

  localStorage.removeItem(CHARACTER_STORAGE_KEYS.CHARACTERS);
  localStorage.removeItem(CHARACTER_STORAGE_KEYS.LEGACY_PROFILE);
  localStorage.removeItem(CHARACTER_STORAGE_KEYS.ACTIVE_CHARACTER_ID);
  window.dispatchEvent(new Event(CHARACTER_CHANGE_EVENT));
}

export function seedLocalCharactersFromProfile(profile: LocalCharacterProfile) {
  if (typeof window === "undefined") return;

  const normalizedProfile = normalizeLocalCharacterProfile(profile);
  const characters = readLocalCharacters();
  const exists = characters.some((character) =>
    (normalizedProfile.character_ocid && character.character_ocid === normalizedProfile.character_ocid) ||
    character.character_name === normalizedProfile.character_name
  );

  if (exists) {
    const existingActive = readActiveCharacterId();
    writeLocalCharacters(characters, existingActive && isUuidLike(existingActive) ? existingActive : characters[0]?.id || null);
    return;
  }

  const nextCharacters = [...characters, normalizedProfile];
  const activeId = normalizedProfile.id || null;
  writeLocalCharacters(nextCharacters, activeId);
}
