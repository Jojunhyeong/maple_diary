import { supabaseAdmin } from '@/shared/lib/supabase';

type AdminClient = ReturnType<typeof supabaseAdmin>;

/**
 * Returns a character owned by the user. A stale client-side id is replaced
 * with the account's active character so it can never create orphaned rows.
 */
export async function resolveOwnedCharacterId(
  db: AdminClient,
  userId: string,
  requestedCharacterId?: string | null,
): Promise<string | null> {
  if (requestedCharacterId) {
    const { data, error } = await db
      .from('characters')
      .select('id')
      .eq('user_id', userId)
      .eq('id', requestedCharacterId)
      .maybeSingle();

    if (error) throw error;
    if (data?.id) return data.id as string;
  }

  const { data, error } = await db
    .from('characters')
    .select('id')
    .eq('user_id', userId)
    .order('is_active', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data?.id as string | undefined) ?? null;
}
