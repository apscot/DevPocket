import { useCallback, useEffect, useState } from 'react'

const EVT = 'dp:storage'
export function readLocal<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem('dp:' + key); return v == null ? fallback : (JSON.parse(v) as T) } catch { return fallback }
}
export function writeLocal<T>(key: string, value: T) {
  try { localStorage.setItem('dp:' + key, JSON.stringify(value)) } catch { /* storage unavailable */ }
  window.dispatchEvent(new CustomEvent(EVT, { detail: key }))
}
/** Persistent, cross-component-synced state. Only use for preferences, never sensitive input. */
export function useLocal<T>(key: string, fallback: T): [T, (v: T | ((p: T) => T)) => void] {
  const [val, setVal] = useState<T>(() => readLocal(key, fallback))
  useEffect(() => {
    const h = (e: Event) => { if ((e as CustomEvent).detail === key) setVal(readLocal(key, fallback)) }
    window.addEventListener(EVT, h)
    return () => window.removeEventListener(EVT, h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const set = useCallback((v: T | ((p: T) => T)) => {
    const next = typeof v === 'function' ? (v as (p: T) => T)(readLocal(key, fallback)) : v
    writeLocal(key, next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return [val, set]
}

export type Theme = 'light' | 'dark' | 'system'
export function applyTheme(t: Theme) {
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}
export const useFavorites = () => {
  const [favs, setFavs] = useLocal<string[]>('favorites', [])
  const toggle = (id: string) => setFavs((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  return { favs, toggle }
}
export const pushRecent = (id: string) => writeLocal('recent', [id, ...readLocal<string[]>('recent', []).filter((x) => x !== id)].slice(0, 12))
