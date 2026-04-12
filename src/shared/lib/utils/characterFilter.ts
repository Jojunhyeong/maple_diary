type CharacterBoundRecord = {
  character_id?: string | null;
};

export function filterRecordsByCharacter<T extends CharacterBoundRecord>(
  records: T[],
  characterId: string | null | undefined,
) {
  if (!characterId) return records;

  const hasAnyCharacterBound = records.some((record) => !!record.character_id);

  if (!hasAnyCharacterBound) {
    return records;
  }

  return records.filter((record) => record.character_id === characterId);
}
