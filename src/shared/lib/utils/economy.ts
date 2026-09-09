export type EconomyEntry = {
  id: string;
  date: string;
  title: string;
  kind: 'hunting' | 'boss' | 'gathering' | 'expense';
  income: number;
  expense: number;
  category?: string;
  characterId?: string | null;
  period?: 'weekly' | 'monthly';
};

export function summarizeEconomy(entries: EconomyEntry[], start: string, end: string) {
  const selected = entries.filter(entry => entry.date >= start && entry.date <= end);
  const sources = { hunting: 0, boss: 0, gathering: 0 };
  let expense = 0;
  const categories: Record<string, number> = {};
  for (const entry of selected) {
    if (entry.kind !== 'expense') sources[entry.kind] += entry.income;
    expense += entry.expense;
    if (entry.expense > 0) {
      const category = entry.kind === 'hunting' ? '사냥 재료비' : entry.category || '기타';
      categories[category] = (categories[category] || 0) + entry.expense;
    }
  }
  const income = sources.hunting + sources.boss + sources.gathering;
  return { entries: selected, sources, income, expense, net: income - expense, categories };
}

export function estimateGoalWeeks(remaining: number, averageWeeklyNet: number) {
  if (remaining <= 0) return 0;
  return averageWeeklyNet > 0 ? Math.ceil(remaining / averageWeeklyNet) : null;
}
