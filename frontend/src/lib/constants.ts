/**
 * App-wide constants. Prefer env vars for deployment; fallbacks for local dev.
 */

const getEnv = (key: string, fallback: string): string =>
  (typeof process !== 'undefined' && process.env?.[key]) || fallback

export const config = {
  apiUrl: getEnv('NEXT_PUBLIC_API_URL', 'http://localhost:8000'),
  wsUrl: getEnv('NEXT_PUBLIC_WS_URL', 'ws://localhost:8000'),
  appName: getEnv('NEXT_PUBLIC_APP_NAME', 'Aura'),
  apiTimeoutMs: 30_000,
} as const

/** Stable prefix for localStorage keys (changing this would log users out). */
const STORAGE_PREFIX = 'aura'
export const storageKeys = {
  auth: `${STORAGE_PREFIX}-auth-storage`,
  whiteboard: (id: string) => `${STORAGE_PREFIX}-whiteboard-${id}`,
} as const
