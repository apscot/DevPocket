import type { Style } from './types'
import { FONTS } from './types'

let ctx: CanvasRenderingContext2D | null | undefined
const cache = new Map<string, number>()
export function measure(s: string, st: Pick<Style, 'fs' | 'font' | 'bold' | 'italic'>): number {
  const key = `${st.fs}|${st.font}|${st.bold ? 1 : 0}${st.italic ? 1 : 0}|${s}`
  const hit = cache.get(key); if (hit !== undefined) return hit
  if (ctx === undefined) { try { ctx = document.createElement('canvas').getContext('2d') } catch { ctx = null } }
  let w: number
  if (ctx) { ctx.font = `${st.italic ? 'italic ' : ''}${st.bold ? '700 ' : '400 '}${st.fs}px ${FONTS[st.font]}`; w = ctx.measureText(s).width } else w = s.length * st.fs * 0.56
  if (!w && s.length) w = s.length * st.fs * 0.56
  if (cache.size > 5000) cache.clear()
  cache.set(key, w); return w
}
export const lineHeight = (fs: number) => Math.round(fs * 1.3)

/** Greedy word wrap that respects explicit newlines and breaks over-long words. */
export function wrap(text: string, maxW: number, st: Pick<Style, 'fs' | 'font' | 'bold' | 'italic'>): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    if (!para) { out.push(''); continue }
    let line = ''
    for (const word of para.split(/(?<= )/)) {
      const trial = line + word
      if (!line || measure(trial.trimEnd(), st) <= maxW) { line = trial; continue }
      out.push(line.trimEnd()); line = word
    }
    // break a single word that is still too wide
    while (measure(line.trimEnd(), st) > maxW && line.length > 1) {
      let n = line.length - 1; while (n > 1 && measure(line.slice(0, n), st) > maxW) n--
      out.push(line.slice(0, n)); line = line.slice(n)
    }
    out.push(line.trimEnd())
  }
  return out
}
