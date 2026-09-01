'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

export type EquipmentCatalogResponse = {
  items?: Array<{
    id?: string;
    slug?: string;
    name?: string;
    slot?: string;
    part?: string;
    job_group?: string | null;
    level?: number | null;
    icon_url?: string | null;
    source_url?: string | null;
  }>;
  parts?: string[];
  error?: string;
};

export const equipmentCatalogQueryKeys = {
  all: ['equipment-catalog'] as const,
  search: (filters: { part: string; job: string; characterClass: string; query: string }) =>
    [...equipmentCatalogQueryKeys.all, filters] as const,
};

export function useEquipmentCatalogQuery({
  part,
  job,
  characterClass,
  query,
  enabled = true,
}: {
  part: string;
  job: string;
  characterClass?: string | null;
  query: string;
  enabled?: boolean;
}) {
  const filters = {
    part,
    job,
    characterClass: characterClass?.trim() ?? '',
    query: query.trim(),
  };

  return useQuery({
    queryKey: equipmentCatalogQueryKeys.search(filters),
    queryFn: async () => {
      const params = new URLSearchParams({ part });
      if (job !== 'all') params.set('job', job);
      if (filters.characterClass) params.set('class', filters.characterClass);
      if (filters.query) params.set('q', filters.query);
      const response = await fetch(`/api/equipment-catalog?${params.toString()}`);
      const payload = (await response.json().catch(() => ({}))) as EquipmentCatalogResponse;
      if (!response.ok) throw new Error(payload.error || '장비 후보를 불러오지 못했습니다');
      return payload;
    },
    enabled,
    placeholderData: keepPreviousData,
  });
}
