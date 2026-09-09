export type MesoSnapshot = { amount: number; updatedAt: string };
export type MesoBalanceDay = { date: string; amount: number | null };

export function mergeMesoSnapshots(
  snapshots: MesoSnapshot[],
  value: { amount: number; updatedAt: string | null },
): MesoSnapshot[] {
  const valid = snapshots.filter(snapshot =>
    Number.isSafeInteger(snapshot.amount) &&
    typeof snapshot.updatedAt === 'string' && Number.isFinite(Date.parse(snapshot.updatedAt)),
  );
  if (value.updatedAt && Number.isFinite(Date.parse(value.updatedAt)) &&
      Number.isSafeInteger(value.amount)) {
    valid.push({ amount: value.amount, updatedAt: value.updatedAt });
  }
  return [...new Map(valid.map(snapshot => [snapshot.updatedAt, snapshot])).values()]
    .sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt))
    .slice(-500);
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Keep the last explicitly saved balance of each day. Unknown days stay unknown:
// economic income includes unsold item valuations and cannot reconstruct cash.
export function sevenDayMesoBalances(snapshots: MesoSnapshot[], today: Date): MesoBalanceDay[] {
  const daily = new Map<string, number>();
  for (const snapshot of mergeMesoSnapshots(snapshots, { amount: 0, updatedAt: null })) {
    daily.set(dateKey(new Date(snapshot.updatedAt)), snapshot.amount);
  }
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(today);
    day.setDate(day.getDate() - 6 + index);
    const date = dateKey(day);
    return { date, amount: daily.get(date) ?? null };
  });
}
