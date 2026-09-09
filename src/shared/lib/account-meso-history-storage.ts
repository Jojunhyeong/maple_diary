import { mergeMesoSnapshots, type MesoSnapshot } from './utils/account-meso-history';

export const MESO_HISTORY_EVENT = 'maple_diary:meso-history-changed';
const PREFIX = 'maple_diary:meso-history:';

export function readMesoHistory(ownerKey: string): MesoSnapshot[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(PREFIX + ownerKey) || '[]');
    if (!Array.isArray(parsed)) return [];
    return mergeMesoSnapshots(parsed.filter((item): item is MesoSnapshot => !!item && typeof item === 'object'), { amount: 0, updatedAt: null });
  } catch { return []; }
}

export function rememberMesoBalance(ownerKey: string, balance: { amount: number; updatedAt: string | null }) {
  if (!balance.updatedAt) return;
  try {
    const key = PREFIX + ownerKey;
    const history = mergeMesoSnapshots(readMesoHistory(ownerKey), balance);
    const serialized = JSON.stringify(history);
    if (localStorage.getItem(key) === serialized) return;
    localStorage.setItem(key, serialized);
    window.dispatchEvent(new Event(MESO_HISTORY_EVENT));
  } catch {
    // Storage restrictions must never block saving the actual account balance.
  }
}
