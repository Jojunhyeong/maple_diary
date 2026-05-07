import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/shared/lib/supabase';

export const dynamic = 'force-dynamic';

type EquipmentCatalogRow = {
  slug: string;
  name: string;
  icon_url: string | null;
  job_group: string | null;
  wiki_title: string | null;
};

function slugToWikiIconUrl(slug: string) {
  const specialTokens: Record<string, string> = {
    absolab: 'AbsoLab',
    arcane: 'Arcane',
    root: 'Root',
    abyss: 'Abyss',
    eternal: 'Eternal',
    meister: 'Meister',
  };

  const setPrefixMap: Record<string, string> = {
    'absolab-': 'AbsoLab',
    'arcane-umbra-': 'Arcane_Umbra',
    'eternal-': 'Eternal',
    'root-abyss-': 'Root_Abyss',
  };

  const genericSetParts = new Set(['shoes', 'gloves', 'cape', 'shoulder']);
  const setPrefix = Object.entries(setPrefixMap).find(([prefix]) => slug.startsWith(prefix))?.[1] ?? null;
  const part = slug.split('-').pop();

  if (setPrefix && part && genericSetParts.has(part)) {
    return `https://media.maplestorywiki.net/yetidb/Eqp_${setPrefix}_${part.charAt(0).toUpperCase() + part.slice(1)}.png`;
  }

  const fileName = `Eqp_${slug
    .split('-')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => specialTokens[part] || part.charAt(0).toUpperCase() + part.slice(1))
    .join('_')}.png`;
  return `https://media.maplestorywiki.net/yetidb/${fileName}`;
}

function slugToSearchTerm(slug: string) {
  return slug
    .split('-')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function normalizeCharacterClass(characterClass: string | null | undefined) {
  return (characterClass || '').trim();
}

function jobRoleTokenFromCharacterClass(characterClass: string | null | undefined) {
  const normalized = normalizeCharacterClass(characterClass);
  if (!normalized) return null;

  if (/히어로|팔라딘|다크나이트|소울마스터|미하일/i.test(normalized)) return 'Knight';
  if (/아크메이지|비숍|플레임위자드|배틀메이지|라라|린/i.test(normalized)) return 'Mage';
  if (/보우마스터|신궁|패스파인더|윈드브레이커|와일드헌터/i.test(normalized)) return 'Archer';
  if (/나이트로드|섀도어|듀얼블레이드|나이트워커|카데나|호영|칼리/i.test(normalized)) return 'Thief';
  if (/바이퍼|캡틴|캐논슈터|스트라이커|블래스터|메카닉|엔젤릭버스터|아크/i.test(normalized)) return 'Pirate';
  if (/아란|에반|메르세데스|팬텀|루미너스|은월|카이저|카인|일리움|아크|제로|키네시스|렌/i.test(normalized)) return 'Knight';

  return null;
}

function setPrefixFromSlug(slug: string) {
  if (slug.startsWith('absolab-')) return 'AbsoLab';
  if (slug.startsWith('arcane-umbra-')) return 'Arcane Umbra';
  if (slug.startsWith('eternal-')) return 'Eternal';
  if (slug.startsWith('root-abyss-')) return 'Root Abyss';
  return null;
}

function jobTokenForSet(setPrefix: string, roleToken: string | null) {
  if (!roleToken) return null;
  if (setPrefix === 'AbsoLab' && roleToken === 'Thief') return 'Bandit';
  return roleToken;
}

function setItemTitleCandidates(slug: string, characterClass: string | null | undefined) {
  const setPrefix = setPrefixFromSlug(slug);
  const roleToken = jobRoleTokenFromCharacterClass(characterClass);
  const jobToken = jobTokenForSet(setPrefix ?? '', roleToken);
  if (!setPrefix || !jobToken) return [];

  if (slug.endsWith('-hat')) {
    const hatTokenMap: Record<string, string[]> = {
      AbsoLab: {
        Knight: ['Helm'],
        Mage: ['Crown'],
        Archer: ['Hood'],
        Bandit: ['Cap'],
        Pirate: ['Fedora'],
      }[jobToken] ?? ['Hat'],
      'Arcane Umbra': ['Hat'],
      Eternal: ['Hat'],
      'Root Abyss': ['Hat'],
    };
    const suffixes = hatTokenMap[setPrefix] ?? ['Hat'];
    return suffixes.map((suffix) => `${setPrefix} ${jobToken} ${suffix}`);
  }

  if (slug.endsWith('-top') || slug.endsWith('-overall')) {
    const suffixes = setPrefix === 'AbsoLab' && jobToken === 'Mage' ? ['Robe', 'Suit'] : ['Suit', 'Robe'];
    return suffixes.map((suffix) => `${setPrefix} ${jobToken} ${suffix}`);
  }

  if (slug.endsWith('-bottom')) {
    return [`${setPrefix} ${jobToken} Pants`, `${setPrefix} ${jobToken} Bottom`];
  }

  const partMap: Record<string, string> = {
    gloves: 'Gloves',
    shoes: 'Shoes',
    cape: 'Cape',
    shoulder: 'Shoulder',
  };
  for (const [partKey, title] of Object.entries(partMap)) {
    if (slug.endsWith(`-${partKey}`)) {
      return [`${setPrefix} ${jobToken} ${title}`];
    }
  }

  return [`${setPrefix} ${jobToken}`];
}

async function fetchWikiImageFromSearch(term: string) {
  const apiUrl = new URL('https://maplestorywiki.net/w/api.php');
  apiUrl.searchParams.set('action', 'query');
  apiUrl.searchParams.set('format', 'json');
  apiUrl.searchParams.set('generator', 'search');
  apiUrl.searchParams.set('gsrsearch', term);
  apiUrl.searchParams.set('gsrlimit', '5');
  apiUrl.searchParams.set('gsrnamespace', '0');
  apiUrl.searchParams.set('prop', 'pageimages');
  apiUrl.searchParams.set('piprop', 'original|thumbnail');
  apiUrl.searchParams.set('pithumbsize', '128');

  const res = await fetch(apiUrl.toString(), {
    headers: {
      accept: 'application/json',
    },
  });

  if (!res.ok) return null;

  const data = (await res.json().catch(() => null)) as
    | {
        query?: {
          pages?: Record<
            string,
            {
              original?: { source?: string };
              thumbnail?: { source?: string };
            }
          >;
        };
      }
    | null;

  const pages = data?.query?.pages;
  if (!pages) return null;

  for (const page of Object.values(pages)) {
    const source = page.original?.source || page.thumbnail?.source;
    if (source) return source;
  }

  return null;
}

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug')?.trim();
  const characterClass = request.nextUrl.searchParams.get('class')?.trim();
  if (!slug) {
    return new Response('slug is required', { status: 400 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from('equipment_catalog')
    .select('slug, name, icon_url, job_group, wiki_title')
    .eq('slug', slug)
    .maybeSingle<EquipmentCatalogRow>();

  if (error) {
    return Response.json({ error: 'equipment icon lookup failed', dbError: { message: error.message, code: error.code } }, { status: 500 });
  }

  if (!data) {
    return new Response('not found', { status: 404 });
  }

  const resolved = await (async () => {
    const candidates = [
      data.icon_url,
      ...(data.wiki_title ? [await fetchWikiImageFromSearch(data.wiki_title)] : []),
      ...setItemTitleCandidates(data.slug, characterClass),
      slugToWikiIconUrl(data.slug),
      await fetchWikiImageFromSearch(data.name),
      await fetchWikiImageFromSearch(slugToSearchTerm(data.slug)),
    ].filter((value): value is string => !!value);

    for (const candidate of candidates) {
      try {
        const upstream = await fetch(candidate, {
          headers: {
            accept: 'image/*',
          },
        });

        if (!upstream.ok || !upstream.body) continue;

        const headers = new Headers();
        const contentType = upstream.headers.get('content-type');
        if (contentType) headers.set('content-type', contentType);
        headers.set('cache-control', 'public, max-age=86400, stale-while-revalidate=604800');

        return new Response(upstream.body, {
          status: upstream.status,
          headers,
        });
      } catch {
        // Try next candidate.
      }
    }

    return null;
  })();
  if (!resolved) {
    return new Response('image not found', { status: 404 });
  }

  return resolved;
}
