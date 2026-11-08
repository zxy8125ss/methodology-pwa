import { get, set, del } from 'idb-keyval';

/** 离线缓存：保存上次成功拉取的数据，网络恢复后可同步 */

const CACHE_KEY = 'methodology-cache-v1';
const CACHE_TS_KEY = 'methodology-cache-ts-v1';

export interface CachedPayload<T = unknown> {
  fetchedAt: string;
  data: T;
}

export async function readCache<T = unknown>(): Promise<CachedPayload<T> | null> {
  try {
    const payload = await get<CachedPayload<T>>(CACHE_KEY);
    if (!payload) return null;
    const ts = await get<number>(CACHE_TS_KEY);
    return { fetchedAt: new Date(ts ?? Date.parse(payload.fetchedAt)).toISOString(), data: payload.data };
  } catch {
    return null;
  }
}

export async function writeCache<T>(data: T): Promise<void> {
  try {
    const payload: CachedPayload<T> = { fetchedAt: new Date().toISOString(), data };
    await set(CACHE_KEY, payload);
    await set(CACHE_TS_KEY, Date.now());
  } catch {
    /* 缓存失败不影响主流程 */
  }
}

export async function clearCache(): Promise<void> {
  try {
    await del(CACHE_KEY);
    await del(CACHE_TS_KEY);
  } catch {
    /* ignore */
  }
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

export function subscribeOnline(cb: (online: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const up = () => cb(true);
  const down = () => cb(false);
  window.addEventListener('online', up);
  window.addEventListener('offline', down);
  return () => {
    window.removeEventListener('online', up);
    window.removeEventListener('offline', down);
  };
}
