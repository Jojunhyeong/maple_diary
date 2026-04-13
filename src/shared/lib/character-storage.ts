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

  const characters = readLocalCharacters();
  const exists = characters.some((character) =>
    (profile.character_ocid && character.character_ocid === profile.character_ocid) ||
    character.character_name === profile.character_name
  );

  if (exists) {
    writeLocalCharacters(characters, readActiveCharacterId() || profile.character_ocid || null);
    return;
  }

  const nextCharacters = [...characters, profile];
  const activeId = profile.character_ocid || profile.id || profile.character_name;
  writeLocalCharacters(nextCharacters, activeId);
}
