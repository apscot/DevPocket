import type { Doc, EdgeEl, El, End, ImageEl, Pt, ShapeEl, ShapeKind, Side, Style } from './types'
import { defaultStyle, emptyDoc } from './types'
import { edgeGeo, nodeMap } from './geom'

let counter = 0
export const uid = () => `${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`

export function newShape(kind: ShapeKind, x: number, y: number, w: number, h: number, o: Omit<Partial<ShapeEl>, 's'> & { s?: Partial<Style> } = {}): ShapeEl {
  const { s, ...rest } = o
  return { id: uid(), t: 'shape', kind, x, y, w, h, text: '', ...rest, s: { ...defaultStyle(), ...s } }
}
export function newEdge(a: End, b: End, o: Omit<Partial<EdgeEl>, 's'> & { s?: Partial<Style> } = {}): EdgeEl {
  const { s, ...rest } = o
  return { id: uid(), t: 'edge', a, b, route: 'orth', bend: 0.5, text: '', tail: 'none', head: 'triangle', ...rest, s: { ...defaultStyle(), fill: 'none', radius: 0, ...s } }
}

export const idsOf = (els: El[]) => new Set(els.map((e) => e.id))
export const pick = (els: El[], ids: Iterable<string>) => { const s = new Set(ids); return els.filter((e) => s.has(e.id)) }

/** Selecting any member of a group selects the whole group. */
export function expandGroups(els: El[], ids: string[]): string[] {
  const groups = new Set(els.filter((e) => ids.includes(e.id) && e.g).map((e) => e.g))
  return groups.size ? els.filter((e) => ids.includes(e.id) || (e.g && groups.has(e.g))).map((e) => e.id) : ids
}

export function removeEls(els: El[], ids: Iterable<string>): El[] {
  const gone = new Set(ids); const nodes = nodeMap(els)
  const out: El[] = []
  for (const e of els) {
    if (gone.has(e.id)) continue
    if (e.t === 'edge' && ((e.a.id && gone.has(e.a.id)) || (e.b.id && gone.has(e.b.id)))) {
      // resolve current geometry first so the edge keeps its place
      const g = edgeGeo(e, nodes)
      const a: End = e.a.id && gone.has(e.a.id) ? { x: g.a.x, y: g.a.y } : e.a
      const b: End = e.b.id && gone.has(e.b.id) ? { x: g.b.x, y: g.b.y } : e.b
      out.push({ ...e, a, b }); continue
    }
    out.push(e)
  }
  return out
}

export function cloneEls(els: El[], ids: string[], dx = 20, dy = 20): El[] {
  const set = new Set(ids); const sel = els.filter((e) => set.has(e.id)); const nodes = nodeMap(els)
  const map = new Map<string, string>(); const gmap = new Map<string, string>()
  for (const e of sel) { map.set(e.id, uid()); if (e.g && !gmap.has(e.g)) gmap.set(e.g, uid()) }
  const res: El[] = []
  for (const e of sel) {
    const id = map.get(e.id) as string; const g = e.g ? gmap.get(e.g) : undefined
    if (e.t === 'shape' || e.t === 'image') res.push({ ...e, id, g, x: e.x + dx, y: e.y + dy })
    else if (e.t === 'stroke') { const pts = e.pts.slice(); for (let i = 0; i < pts.length; i += 3) { pts[i] += dx; pts[i + 1] += dy } res.push({ ...e, id, g, pts }) }
    else {
      const geo = edgeGeo(e, nodes)
      const end = (en: End, p: Pt): End => (en.id && map.has(en.id) ? { ...en, id: map.get(en.id) } : { x: p.x + dx, y: p.y + dy })
      res.push({ ...e, id, g, a: end(e.a, geo.a), b: end(e.b, geo.b) })
    }
  }
  return res
}

export type Order = 'front' | 'back' | 'forward' | 'backward'
export function reorder(els: El[], ids: string[], how: Order): El[] {
  const set = new Set(ids); const sel = els.filter((e) => set.has(e.id)); const rest = els.filter((e) => !set.has(e.id))
  if (!sel.length) return els
  if (how === 'front') return [...rest, ...sel]
  if (how === 'back') return [...sel, ...rest]
  const out = els.slice()
  if (how === 'forward') { for (let i = out.length - 2; i >= 0; i--) if (set.has(out[i].id) && !set.has(out[i + 1].id)) { const t = out[i]; out[i] = out[i + 1]; out[i + 1] = t } }
  else { for (let i = 1; i < out.length; i++) if (set.has(out[i].id) && !set.has(out[i - 1].id)) { const t = out[i]; out[i] = out[i - 1]; out[i - 1] = t } }
  return out
}
export const groupEls = (els: El[], ids: string[]): El[] => { const g = uid(); const s = new Set(ids); return els.map((e) => (s.has(e.id) ? { ...e, g } : e)) }
export const ungroupEls = (els: El[], ids: string[]): El[] => { const s = new Set(ids); return els.map((e) => (s.has(e.id) && e.g ? { ...e, g: undefined } : e)) }

export function moveEl(e: El, dx: number, dy: number): El {
  if (e.t === 'shape' || e.t === 'image') return { ...e, x: e.x + dx, y: e.y + dy }
  if (e.t === 'stroke') { const pts = e.pts.slice(); for (let i = 0; i < pts.length; i += 3) { pts[i] += dx; pts[i + 1] += dy } return { ...e, pts } }
  const mv = (en: End): End => (en.id ? en : { ...en, x: (en.x ?? 0) + dx, y: (en.y ?? 0) + dy })
  return { ...e, a: mv(e.a), b: mv(e.b) }
}

// ---------- (de)serialization ----------
const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d)
function style(v: unknown): Style {
  const base = defaultStyle(); if (!v || typeof v !== 'object') return base
  const o = v as Record<string, unknown>; const out = { ...base }
  for (const k of Object.keys(base) as (keyof Style)[]) { const x = o[k]; if (typeof x === typeof base[k]) (out as Record<string, unknown>)[k] = x }
  out.opacity = Math.min(1, Math.max(0, out.opacity)); out.sw = Math.min(40, Math.max(0, out.sw)); out.fs = Math.min(200, Math.max(6, out.fs))
  return out
}
const END = (v: unknown): End => { const o = (v ?? {}) as Record<string, unknown>; const e: End = {}; if (typeof o.id === 'string') e.id = o.id; if (['t', 'r', 'b', 'l'].includes(o.side as string)) e.side = o.side as Side; if (typeof o.x === 'number') e.x = o.x; if (typeof o.y === 'number') e.y = o.y; return e }
const KINDS = new Set(['rect', 'ellipse', 'diamond', 'triangle', 'hexagon', 'parallelogram', 'trapezoid', 'cylinder', 'cloud', 'document', 'process', 'callout', 'star', 'actor', 'class', 'package', 'note', 'text', 'icon', 'chevron'])
const ARROWS = new Set(['none', 'arrow', 'triangle', 'open', 'diamond', 'dot', 'bar'])

/** Validates untrusted JSON (opened file / localStorage) into a Doc. Throws on garbage. */
export function parseDoc(json: string): Doc {
  const raw = JSON.parse(json) as Record<string, unknown>
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.els)) throw new Error('Not a DevPocket drawing file')
  const els: El[] = []; const seen = new Set<string>()
  for (const r of raw.els as Record<string, unknown>[]) {
    if (!r || typeof r !== 'object') continue
    let id = str(r.id) || uid(); if (seen.has(id)) id = uid(); seen.add(id)
    const base = { id, g: typeof r.g === 'string' ? r.g : undefined, lock: r.lock === true ? true : undefined }
    if (r.t === 'shape' && KINDS.has(r.kind as string)) els.push({ ...base, t: 'shape', kind: r.kind as ShapeKind, x: num(r.x), y: num(r.y), w: Math.max(4, num(r.w, 100)), h: Math.max(4, num(r.h, 60)), text: str(r.text), s: style(r.s), ic: typeof r.ic === 'string' ? r.ic : undefined })
    else if (r.t === 'edge') els.push({ ...base, t: 'edge', a: END(r.a), b: END(r.b), route: ['straight', 'orth', 'curve'].includes(r.route as string) ? (r.route as EdgeEl['route']) : 'orth', bend: Math.min(0.95, Math.max(0.05, num(r.bend, 0.5))), text: str(r.text), s: style(r.s), tail: ARROWS.has(r.tail as string) ? (r.tail as EdgeEl['tail']) : 'none', head: ARROWS.has(r.head as string) ? (r.head as EdgeEl['head']) : 'triangle' })
    else if (r.t === 'stroke' && Array.isArray(r.pts)) { const pts = (r.pts as unknown[]).map((n) => num(n)); if (pts.length >= 3) els.push({ ...base, t: 'stroke', pts: pts.slice(0, pts.length - (pts.length % 3)), s: style(r.s), hl: r.hl === true ? true : undefined }) }
    else if (r.t === 'image' && typeof r.src === 'string' && /^data:image\/(png|jpe?g|gif|webp|svg\+xml|avif);/i.test(r.src)) els.push({ ...base, t: 'image', x: num(r.x), y: num(r.y), w: Math.max(4, num(r.w, 100)), h: Math.max(4, num(r.h, 100)), src: r.src, s: style(r.s) } as ImageEl)
  }
  const d = emptyDoc()
  return { v: 1, els, bg: typeof raw.bg === 'string' && /^#[0-9a-f]{3,8}$/i.test(raw.bg) ? raw.bg : d.bg, grid: raw.grid !== false, gridSize: Math.min(100, Math.max(5, num(raw.gridSize, 20))), snap: raw.snap !== false }
}
export const serializeDoc = (d: Doc) => JSON.stringify({ app: 'DevPocket', ...d })
