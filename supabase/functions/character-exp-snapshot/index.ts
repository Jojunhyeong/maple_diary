// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2';

type ExpHistoryEntry = {
  date: string;
  exp_gain_percent: number;
};

type CharacterRow = {
  id: string;
  character_name: string;
  character_ocid?: string | null;
  character_world?: string | null;
  character_exp_rate?: number | string | null;
  character_combat_power?: number | null;
  character_exp_history?: ExpHistoryEntry[] | null;
  level?: number | null;
  image_url?: string | null;
};

const MAPLE_API_BASE = 'https://open.api.nexon.com/maplestory/v1';

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

function parsePercentValue(value?: number | string | null) {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseCombatPower(finalStats: unknown): number | null {
  if (!Array.isArray(finalStats)) return null;

  for (const stat of finalStats) {
    if (!stat || typeof stat !== 'object') continue;
    const name = (stat as { stat_name?: unknown }).stat_name;
    const value = (stat as { stat_value?: unknown }).stat_value;

    if (typeof name !== 'string' || typeof value !== 'string') continue;
    if (!name.includes('전투력')) continue;

    const parsed = Number(value.replace(/[^\d]/g, ''));
    if (!Number.isNaN(parsed)) return parsed;
  }

  return null;
}

function formatKstDate(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function getKstTime(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    hour: Number(map.hour ?? 0),
    minute: Number(map.minute ?? 0),
  };
}

function normalizeHistory(history: unknown): ExpHistoryEntry[] {
  if (!Array.isArray(history)) return [];

  return history
    .filter(
      (entry) =>
        entry &&
        typeof entry === 'object' &&
        typeof (entry as { date?: unknown }).date === 'string' &&
        typeof (entry as { exp_gain_percent?: unknown }).exp_gain_percent === 'number',
    )
    .map((entry) => ({
      date: (entry as { date: string }).date,
      exp_gain_percent: (entry as { exp_gain_percent: number }).exp_gain_percent,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-7);
}

function upsertHistory(history: ExpHistoryEntry[], date: string, exp_gain_percent: number) {
  const normalized = new Map<string, number>();
  for (const item of history) {
    normalized.set(item.date, Number(item.exp_gain_percent) || 0);
  }

  normalized.set(date, Number(exp_gain_percent) || 0);

  return Array.from(normalized.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7)
    .map(([entryDate, entryValue]) => ({
      date: entryDate,
      exp_gain_percent: entryValue,
    }));
}

async function fetchFromNexon(apiKey: string, character: CharacterRow) {
  const name = character.character_name.trim();
  const ocid = character.character_ocid?.trim() || null;

  let resolvedOcid = ocid;
  if (!resolvedOcid) {
    const idRes = await fetch(
      `${MAPLE_API_BASE}/id?character_name=${encodeURIComponent(name)}`,
      { headers: { 'x-nxopen-api-key': apiKey } },
    );

    if (!idRes.ok) {
      const message = await idRes.json().catch(() => ({}));
      throw new Error(message?.error?.message || 'OCID 조회 실패');
    }

    const idData = await idRes.json();
    resolvedOcid = idData.ocid;
  }

  if (!resolvedOcid) {
    throw new Error('OCID가 없습니다');
  }

  const [basicRes, statRes] = await Promise.all([
    fetch(
      `${MAPLE_API_BASE}/character/basic?ocid=${resolvedOcid}`,
      { headers: { 'x-nxopen-api-key': apiKey } },
    ),
    fetch(
      `${MAPLE_API_BASE}/character/stat?ocid=${resolvedOcid}`,
      { headers: { 'x-nxopen-api-key': apiKey } },
    ),
  ]);

  if (!basicRes.ok) {
    const err = await basicRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || '캐릭터 정보 조회 실패');
  }

  const basic = await basicRes.json();
  const stat = statRes.ok ? await statRes.json().catch(() => null) : null;

  return {
    character_ocid: resolvedOcid,
    character_name: basic.character_name,
    character_world: basic.world_name ?? null,
    character_level: basic.character_level,
    character_exp_rate: basic.character_exp_rate ?? null,
    character_combat_power: parseCombatPower(stat?.final_stat),
    character_image: basic.character_image ?? null,
  };
}

export default {
  async fetch(req: Request) {
    const cronSecret = getRequiredEnv('CRON_SECRET');
    if (req.headers.get('apikey') !== cronSecret) {
      return Response.json({ error: 'forbidden' }, { status: 401 });
    }

    const url = new URL(req.url);
    const force = url.searchParams.get('force') === '1';
    const now = new Date();
    const kst = getKstTime(now);

    if (!force && !(kst.hour === 23 && kst.minute === 59)) {
      return Response.json({
        ok: true,
        skipped: true,
        reason: 'not-scheduled-time',
        kstTime: `${String(kst.hour).padStart(2, '0')}:${String(kst.minute).padStart(2, '0')}`,
      });
    }

    const supabaseUrl = getRequiredEnv('SUPABASE_URL');
    const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const mapleApiKey = getRequiredEnv('MAPLE_API_KEY');
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: characters, error } = await supabase
      .from('characters')
      .select('id, character_name, character_ocid, character_world, character_exp_rate, character_combat_power, character_exp_history, level, image_url')
      .order('updated_at', { ascending: false });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    const today = formatKstDate(now);
    const updatedIds: string[] = [];
    const failures: Array<{ id: string; error: string }> = [];

    for (const character of (characters ?? []) as CharacterRow[]) {
      if (!character?.id || !character.character_name) continue;

      try {
        const snapshot = await fetchFromNexon(mapleApiKey, character);
        const nextHistory = upsertHistory(
          normalizeHistory(character.character_exp_history),
          today,
          parsePercentValue(snapshot.character_exp_rate),
        );

        const { error: updateError } = await supabase
          .from('characters')
          .update({
            character_ocid: snapshot.character_ocid,
            character_world: snapshot.character_world,
            character_exp_rate: snapshot.character_exp_rate,
            character_combat_power: snapshot.character_combat_power,
            character_exp_history: nextHistory,
            level: snapshot.character_level ?? character.level ?? 1,
            image_url: snapshot.character_image ?? character.image_url ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', character.id);

        if (updateError) {
          throw new Error(updateError.message);
        }

        updatedIds.push(character.id);
      } catch (err) {
        failures.push({
          id: character.id,
          error: err instanceof Error ? err.message : 'unknown error',
        });
      }
    }

    return Response.json({
      ok: true,
      kstDate: today,
      updated: updatedIds.length,
      failures,
    });
  },
};
