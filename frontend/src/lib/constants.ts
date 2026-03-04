/**
 * App-wide constants. Next.js inlines only static process.env.NEXT_PUBLIC_* references at build time.
 */

export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000',
  wsUrl: process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8000',
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? 'Aura',
  apiTimeoutMs: 30_000,
} as const

/** Stable prefix for localStorage keys (changing this would log users out). */
const STORAGE_PREFIX = 'aura'
export const storageKeys = {
  auth: `${STORAGE_PREFIX}-auth-storage`,
  whiteboard: (id: string) => `${STORAGE_PREFIX}-whiteboard-${id}`,
} as const
