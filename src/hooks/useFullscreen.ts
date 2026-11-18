import { useCallback, useEffect, useRef, useState } from 'react'

/** Full-screen a single element. Uses the Fullscreen API; falls back to a fixed overlay where it is unavailable (e.g. iPhone Safari). */
export function useFullscreen<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null)
  const [native, setNative] = useState(false); const [overlay, setOverlay] = useState(false)
  useEffect(() => {
    const sync = () => setNative(!!ref.current && document.fullscreenElement === ref.current)
    document.addEventListener('fullscreenchange', sync); return () => document.removeEventListener('fullscreenchange', sync)
  }, [])
  useEffect(() => {
    if (!overlay) return
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOverlay(false) }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [overlay])
  const toggle = useCallback(async () => {
    const el = ref.current; if (!el) return
    if (document.fullscreenElement === el) { await document.exitFullscreen().catch(() => {}); return }
    if (overlay) { setOverlay(false); return }
    if (el.requestFullscreen) { try { await el.requestFullscreen(); return } catch { /* fall through */ } }
    setOverlay(true)
  }, [overlay])
  const on = native || overlay
  /** Classes to put on the full-screened element while active. */
  const cls = on ? (native ? 'bg-background p-2 overflow-auto' : 'fixed inset-0 z-50 bg-background p-2 overflow-auto') : ''
  return { ref, on, toggle, cls }
}
