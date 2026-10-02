const KEY = 'earth_travel_token';

function safe<T>(fn: () => T, fallback: T): T {
  try { return fn(); } catch { return fallback; }
}

export const tokenStore = {
  get: async () => safe(() => localStorage.getItem(KEY), null),
  set: async (token: string) => safe(() => localStorage.setItem(KEY, token), undefined),
  clear: async () => safe(() => localStorage.removeItem(KEY), undefined),
};
