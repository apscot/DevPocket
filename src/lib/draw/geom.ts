import type { ArrowKind, EdgeEl, El, End, Node, Pt, Rect, ShapeEl, Side } from './types'
import { alwaysSolid, shapeGeom } from './shapes'
import { measure, lineHeight } from './text'

export const r2 = (n: number) => Math.round(n * 100) / 100
export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)
export const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
export function isDarkColor(hex: string): boolean {
  const h = hex.replace('#', ''); const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.4
}
export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

export function distToSeg(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y; const l2 = dx * dx + dy * dy
  if (!l2) return dist(p, a)
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / l2, 0, 1)
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}
export function distToPolyline(p: Pt, pts: Pt[]): number {
  let m = Infinity
  for (let i = 1; i < pts.length; i++) m = Math.min(m, distToSeg(p, pts[i - 1], pts[i]))
  if (pts.length === 1) m = dist(p, pts[0])
  return m
}
export function pointInPoly(p: Pt, poly: Pt[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}
export const inRect = (p: Pt, r: Rect) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h
export const rectsHit = (a: Rect, b: Rect) => a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y
export const padRect = (r: Rect, n: number): Rect => ({ x: r.x - n, y: r.y - n, w: r.w + n * 2, h: r.h + n * 2 })
export function unionRect(rs: Rect[]): Rect | null {
  if (!rs.length) return null
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity
  for (const r of rs) { x1 = Math.min(x1, r.x); y1 = Math.min(y1, r.y); x2 = Math.max(x2, r.x + r.w); y2 = Math.max(y2, r.y + r.h) }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
}
export const normRect = (a: Pt, b: Pt): Rect => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) })

// ---------- nodes & anchors ----------
export type NodeMap = Map<string, Node>
export const nodeMap = (els: El[]): NodeMap => { const m: NodeMap = new Map(); for (const e of els) if (e.t === 'shape' || e.t === 'image') m.set(e.id, e); return m }
export const nodeRect = (n: Node): Rect => ({ x: n.x, y: n.y, w: n.w, h: n.h })
export const center = (n: Node): Pt => ({ x: n.x + n.w / 2, y: n.y + n.h / 2 })
export const NORMAL: Record<Side, Pt> = { t: { x: 0, y: -1 }, r: { x: 1, y: 0 }, b: { x: 0, y: 1 }, l: { x: -1, y: 0 } }
export const OPPOSITE: Record<Side, Side> = { t: 'b', b: 't', l: 'r', r: 'l' }
export const SIDES: Side[] = ['t', 'r', 'b', 'l']
export function anchor(n: Node, side: Side): Pt {
  switch (side) { case 't': return { x: n.x + n.w / 2, y: n.y }; case 'r': return { x: n.x + n.w, y: n.y + n.h / 2 }; case 'b': return { x: n.x + n.w / 2, y: n.y + n.h }; case 'l': return { x: n.x, y: n.y + n.h / 2 } }
}
export function nearestSide(n: Node, p: Pt): { side: Side; d: number } {
  let best: Side = 't', bd = Infinity
  for (const s of SIDES) { const d = dist(anchor(n, s), p); if (d < bd) { bd = d; best = s } }
  return { side: best, d: bd }
}
/** Which sides face each other for two rectangles. */
export function facingSides(a: Rect, b: Rect): [Side, Side] {
  const dx = b.x + b.w / 2 - (a.x + a.w / 2), dy = b.y + b.h / 2 - (a.y + a.h / 2)
  if (Math.abs(dx) * (a.h + b.h) >= Math.abs(dy) * (a.w + b.w)) return dx >= 0 ? ['r', 'l'] : ['l', 'r']
  return dy >= 0 ? ['b', 't'] : ['t', 'b']
}
function sidesToward(a: Rect, p: Pt): Side {
  const dx = p.x - (a.x + a.w / 2), dy = p.y - (a.y + a.h / 2)
  return Math.abs(dx) * a.h >= Math.abs(dy) * a.w ? (dx >= 0 ? 'r' : 'l') : dy >= 0 ? 'b' : 't'
}
function rayPoly(o: Pt, d: Pt, poly: Pt[]): Pt | null {
  let best: number | null = null
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length]
    const ex = b.x - a.x, ey = b.y - a.y; const den = d.x * ey - d.y * ex
    if (Math.abs(den) < 1e-9) continue
    const t = ((a.x - o.x) * ey - (a.y - o.y) * ex) / den; const u = ((a.x - o.x) * d.y - (a.y - o.y) * d.x) / den
    if (t > 1e-6 && u >= -1e-6 && u <= 1 + 1e-6 && (best === null || t > best)) best = t
  }
  return best === null ? null : { x: o.x + d.x * best, y: o.y + d.y * best }
}
/** Point where the ray from the node centre toward `toward` leaves the node outline. */
export function borderPoint(n: Node, toward: Pt): Pt {
  const c = center(n); const d = { x: toward.x - c.x, y: toward.y - c.y }
  if (!d.x && !d.y) return c
  const poly = n.t === 'shape' ? shapeGeom(n.kind, n.w, n.h).poly.map((p) => ({ x: p.x + n.x, y: p.y + n.y })) : [{ x: n.x, y: n.y }, { x: n.x + n.w, y: n.y }, { x: n.x + n.w, y: n.y + n.h }, { x: n.x, y: n.y + n.h }]
  return rayPoly(c, d, poly) ?? c
}

// ---------- edge routing ----------
export interface EdgeGeo { pts: Pt[]; d: string; mid: Pt; a: Pt; b: Pt; tailDir: Pt; headDir: Pt; bendHandle: { p: Pt; axis: 'x' | 'y' } | null }
const PAD = 26

function endInfo(end: End, nodes: NodeMap): { p: Pt | null; node: Node | null } {
  const n = end.id ? nodes.get(end.id) ?? null : null
  if (n) return { p: null, node: n }
  return { p: { x: end.x ?? 0, y: end.y ?? 0 }, node: null }
}
const horiz = (s: Side) => s === 'l' || s === 'r'
const dedupe = (pts: Pt[]) => { const o: Pt[] = []; for (const p of pts) { const l = o[o.length - 1]; if (!l || Math.abs(l.x - p.x) > 0.01 || Math.abs(l.y - p.y) > 0.01) o.push(p) } return o }
function simplify(pts: Pt[]) {
  const q = dedupe(pts); const o: Pt[] = []
  for (const p of q) {
    while (o.length >= 2) { const a = o[o.length - 2], b = o[o.length - 1]; if ((Math.abs(a.x - b.x) < 0.01 && Math.abs(b.x - p.x) < 0.01) || (Math.abs(a.y - b.y) < 0.01 && Math.abs(b.y - p.y) < 0.01)) o.pop(); else break }
    o.push(p)
  }
  return o
}

export function orthPoints(A: Pt, sa: Side, B: Pt, sb: Side, bend: number): { pts: Pt[]; handle: { p: Pt; axis: 'x' | 'y' } | null } {
  const na = NORMAL[sa], nb = NORMAL[sb]
  const A1 = { x: A.x + na.x * PAD, y: A.y + na.y * PAD }, B1 = { x: B.x + nb.x * PAD, y: B.y + nb.y * PAD }
  let pts: Pt[]; let handle: { p: Pt; axis: 'x' | 'y' } | null = null
  if (horiz(sa) && horiz(sb)) {
    const facing = (sa === 'r' && sb === 'l' && A.x + 2 <= B.x) || (sa === 'l' && sb === 'r' && A.x >= B.x + 2)
    if (facing) { const mx = A.x + (B.x - A.x) * bend; pts = [A, { x: mx, y: A.y }, { x: mx, y: B.y }, B]; handle = { p: { x: mx, y: (A.y + B.y) / 2 }, axis: 'x' } }
    else if (sa === sb) { const x = sa === 'r' ? Math.max(A.x, B.x) + PAD : Math.min(A.x, B.x) - PAD; pts = [A, { x, y: A.y }, { x, y: B.y }, B] }
    else { const my = Math.abs(A.y - B.y) < 8 ? A.y + 70 : (A.y + B.y) / 2; pts = [A, A1, { x: A1.x, y: my }, { x: B1.x, y: my }, B1, B] }
  } else if (!horiz(sa) && !horiz(sb)) {
    const facing = (sa === 'b' && sb === 't' && A.y + 2 <= B.y) || (sa === 't' && sb === 'b' && A.y >= B.y + 2)
    if (facing) { const my = A.y + (B.y - A.y) * bend; pts = [A, { x: A.x, y: my }, { x: B.x, y: my }, B]; handle = { p: { x: (A.x + B.x) / 2, y: my }, axis: 'y' } }
    else if (sa === sb) { const y = sa === 'b' ? Math.max(A.y, B.y) + PAD : Math.min(A.y, B.y) - PAD; pts = [A, { x: A.x, y }, { x: B.x, y }, B] }
    else { const mx = Math.abs(A.x - B.x) < 8 ? A.x + 70 : (A.x + B.x) / 2; pts = [A, A1, { x: mx, y: A1.y }, { x: mx, y: B1.y }, B1, B] }
  } else if (horiz(sa)) {
    const ok = (sa === 'r' ? B.x > A.x : B.x < A.x) && (sb === 't' ? A.y < B.y : A.y > B.y)
    pts = ok ? [A, { x: B.x, y: A.y }, B] : [A, A1, { x: A1.x, y: B1.y }, B1, B]
  } else {
    const ok = (sa === 'b' ? B.y > A.y : B.y < A.y) && (sb === 'l' ? A.x < B.x : A.x > B.x)
    pts = ok ? [A, { x: A.x, y: B.y }, B] : [A, A1, { x: B1.x, y: A1.y }, B1, B]
  }
  return { pts: simplify(pts), handle }
}

function roundedPath(pts: Pt[], radius = 8): string {
  if (pts.length < 3) return `M${r2(pts[0].x)} ${r2(pts[0].y)} L${r2(pts[pts.length - 1].x)} ${r2(pts[pts.length - 1].y)}`
  let d = `M${r2(pts[0].x)} ${r2(pts[0].y)}`
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1]
    const r = Math.min(radius, dist(p0, p1) / 2, dist(p1, p2) / 2)
    const a = { x: p1.x + ((p0.x - p1.x) / (dist(p0, p1) || 1)) * r, y: p1.y + ((p0.y - p1.y) / (dist(p0, p1) || 1)) * r }
    const b = { x: p1.x + ((p2.x - p1.x) / (dist(p1, p2) || 1)) * r, y: p1.y + ((p2.y - p1.y) / (dist(p1, p2) || 1)) * r }
    d += ` L${r2(a.x)} ${r2(a.y)} Q${r2(p1.x)} ${r2(p1.y)} ${r2(b.x)} ${r2(b.y)}`
  }
  const l = pts[pts.length - 1]; return d + ` L${r2(l.x)} ${r2(l.y)}`
}
export const polylineLength = (pts: Pt[]) => { let l = 0; for (let i = 1; i < pts.length; i++) l += dist(pts[i - 1], pts[i]); return l }
export function pointAlong(pts: Pt[], t: number): Pt {
  const total = polylineLength(pts); let want = total * t
  for (let i = 1; i < pts.length; i++) { const l = dist(pts[i - 1], pts[i]); if (want <= l || i === pts.length - 1) { const k = l ? want / l : 0; return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k } } want -= l }
  return pts[0]
}
const unit = (a: Pt, b: Pt): Pt => { const l = dist(a, b) || 1; return { x: (b.x - a.x) / l, y: (b.y - a.y) / l } }

export function edgeGeo(e: EdgeEl, nodes: NodeMap): EdgeGeo {
  const ia = endInfo(e.a, nodes), ib = endInfo(e.b, nodes)
  const ra = ia.node ? nodeRect(ia.node) : null, rb = ib.node ? nodeRect(ib.node) : null
  const rough = (n: Node | null, p: Pt | null): Pt => (n ? center(n) : (p as Pt))
  let A: Pt, B: Pt, sa: Side | null = null, sb: Side | null = null
  if (e.route === 'straight') {
    A = ia.node ? borderPoint(ia.node, ib.node ? center(ib.node) : (ib.p as Pt)) : (ia.p as Pt)
    B = ib.node ? borderPoint(ib.node, ia.node ? center(ia.node) : (ia.p as Pt)) : (ib.p as Pt)
    if (ia.node && e.a.side) { sa = e.a.side; A = anchor(ia.node, sa) }
    if (ib.node && e.b.side) { sb = e.b.side; B = anchor(ib.node, sb) }
  } else {
    if (ia.node) sa = e.a.side ?? null; if (ib.node) sb = e.b.side ?? null
    if (ra && rb && (!sa || !sb)) { const [fa, fb] = facingSides(ra, rb); sa = sa ?? fa; sb = sb ?? fb }
    if (ra && !sa) sa = sidesToward(ra, rough(ib.node, ib.p))
    if (rb && !sb) sb = sidesToward(rb, rough(ia.node, ia.p))
    A = ia.node ? anchor(ia.node, sa as Side) : (ia.p as Pt)
    B = ib.node ? anchor(ib.node, sb as Side) : (ib.p as Pt)
    // free ends: pick a natural direction
    if (!sa) sa = Math.abs(B.x - A.x) >= Math.abs(B.y - A.y) ? (B.x >= A.x ? 'r' : 'l') : B.y >= A.y ? 'b' : 't'
    if (!sb) sb = Math.abs(B.x - A.x) >= Math.abs(B.y - A.y) ? (B.x >= A.x ? 'l' : 'r') : B.y >= A.y ? 't' : 'b'
  }
  let pts: Pt[]; let d: string; let handle: EdgeGeo['bendHandle'] = null
  if (e.route === 'orth') {
    const r = orthPoints(A, sa as Side, B, sb as Side, e.bend); pts = r.pts; handle = r.handle; d = roundedPath(pts)
  } else if (e.route === 'curve') {
    const k = Math.max(40, dist(A, B) / 2.5)
    const na = ia.node && sa ? NORMAL[sa] : null, nb = ib.node && sb ? NORMAL[sb] : null
    const c1 = na ? { x: A.x + na.x * k, y: A.y + na.y * k } : { x: A.x + (B.x - A.x) / 3, y: A.y + (B.y - A.y) / 3 }
    const c2 = nb ? { x: B.x + nb.x * k, y: B.y + nb.y * k } : { x: B.x - (B.x - A.x) / 3, y: B.y - (B.y - A.y) / 3 }
    pts = []; for (let i = 0; i <= 28; i++) { const t = i / 28, u = 1 - t; pts.push({ x: u * u * u * A.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * B.x, y: u * u * u * A.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * B.y }) }
    d = `M${r2(A.x)} ${r2(A.y)} C${r2(c1.x)} ${r2(c1.y)} ${r2(c2.x)} ${r2(c2.y)} ${r2(B.x)} ${r2(B.y)}`
  } else { pts = [A, B]; d = `M${r2(A.x)} ${r2(A.y)} L${r2(B.x)} ${r2(B.y)}` }
  if (pts.length < 2) pts = [A, B]
  const n = pts.length
  return { pts, d, mid: pointAlong(pts, 0.5), a: A, b: B, tailDir: unit(pts[1], pts[0]), headDir: unit(pts[n - 2], pts[n - 1]), bendHandle: handle }
}

/** Arrowhead drawn at `tip`, `dir` pointing out of the line toward the tip. */
export function arrowHead(kind: ArrowKind, tip: Pt, dir: Pt, size: number): { d: string; filled: boolean } | null {
  if (kind === 'none') return null
  const nx = -dir.y, ny = dir.x; const P = (b: number, s: number) => `${r2(tip.x - dir.x * b + nx * s)} ${r2(tip.y - dir.y * b + ny * s)}`
  const T = `${r2(tip.x)} ${r2(tip.y)}`
  switch (kind) {
    case 'arrow': return { d: `M${P(size, size * 0.55)} L${T} L${P(size, -size * 0.55)}`, filled: false }
    case 'triangle': return { d: `M${T} L${P(size, size * 0.5)} L${P(size, -size * 0.5)} Z`, filled: true }
    case 'open': return { d: `M${T} L${P(size, size * 0.5)} L${P(size, -size * 0.5)} Z`, filled: false }
    case 'diamond': return { d: `M${T} L${P(size / 2, size * 0.4)} L${P(size, 0)} L${P(size / 2, -size * 0.4)} Z`, filled: true }
    case 'dot': { const r = size * 0.4; const c = { x: tip.x - dir.x * r, y: tip.y - dir.y * r }; return { d: `M${r2(c.x - r)} ${r2(c.y)} a${r2(r)} ${r2(r)} 0 1 0 ${r2(r * 2)} 0 a${r2(r)} ${r2(r)} 0 1 0 ${r2(-r * 2)} 0`, filled: true } }
    case 'bar': return { d: `M${P(0, size * 0.6)} L${P(0, -size * 0.6)}`, filled: false }
  }
}

// ---------- bounds & hit testing ----------
export function textSize(text: string, s: { fs: number; font: ShapeEl['s']['font']; bold: boolean; italic: boolean }, maxW?: number) {
  const lines = text.split('\n'); let w = 0
  for (const l of lines) w = Math.max(w, measure(l, s))
  return { w: maxW ? Math.min(w, maxW) : w, h: lines.length * lineHeight(s.fs) }
}
export function elRect(e: El, nodes: NodeMap): Rect {
  if (e.t === 'shape' || e.t === 'image') return { x: e.x, y: e.y, w: e.w, h: e.h }
  if (e.t === 'stroke') {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity
    for (let i = 0; i < e.pts.length; i += 3) { x1 = Math.min(x1, e.pts[i]); y1 = Math.min(y1, e.pts[i + 1]); x2 = Math.max(x2, e.pts[i]); y2 = Math.max(y2, e.pts[i + 1]) }
    const pad = e.s.sw / 2 + 1; return { x: x1 - pad, y: y1 - pad, w: x2 - x1 + pad * 2, h: y2 - y1 + pad * 2 }
  }
  const g = edgeGeo(e, nodes); return unionRect(g.pts.map((p) => ({ x: p.x, y: p.y, w: 0, h: 0 }))) as Rect
}
export function boundsOf(els: El[]): Rect | null { const m = nodeMap(els); return unionRect(els.map((e) => elRect(e, m))) }

export function hitEl(e: El, p: Pt, tol: number, nodes: NodeMap): boolean {
  switch (e.t) {
    case 'image': return inRect(p, padRect(elRect(e, nodes), 0))
    case 'shape': {
      const g = shapeGeom(e.kind, e.w, e.h); const lp = { x: p.x - e.x, y: p.y - e.y }
      if (!inRect(lp, padRect({ x: 0, y: 0, w: e.w, h: e.h }, tol))) return false
      if (e.s.fill !== 'none' || alwaysSolid(e.kind) || e.text) { if (pointInPoly(lp, g.poly)) return true }
      return distToPolyline(lp, [...g.poly, g.poly[0]]) <= tol + e.s.sw / 2
    }
    case 'stroke': {
      const r = padRect(elRect(e, nodes), tol); if (!inRect(p, r)) return false
      const pts: Pt[] = []; for (let i = 0; i < e.pts.length; i += 3) pts.push({ x: e.pts[i], y: e.pts[i + 1] })
      return distToPolyline(p, pts) <= tol + Math.max(e.s.sw, 4) / 2
    }
    case 'edge': {
      const g = edgeGeo(e, nodes)
      if (distToPolyline(p, g.pts) <= tol + e.s.sw / 2) return true
      if (e.text) { const t = textSize(e.text, e.s); return inRect(p, { x: g.mid.x - t.w / 2 - 6, y: g.mid.y - t.h / 2 - 4, w: t.w + 12, h: t.h + 8 }) }
      return false
    }
  }
}
export function rectIntersectsEl(e: El, r: Rect, nodes: NodeMap): boolean { return rectsHit(r, elRect(e, nodes)) }

// ---------- snapping, resize, align ----------
export interface Guide { x1: number; y1: number; x2: number; y2: number }
export function snapRect(m: Rect, others: Rect[], thr: number, grid = 0): { dx: number; dy: number; guides: Guide[] } {
  const xs = [m.x, m.x + m.w / 2, m.x + m.w], ys = [m.y, m.y + m.h / 2, m.y + m.h]
  let bx: { d: number; at: number; o: Rect } | null = null, by: { d: number; at: number; o: Rect } | null = null
  for (const o of others) {
    for (const ox of [o.x, o.x + o.w / 2, o.x + o.w]) for (const mx of xs) { const d = ox - mx; if (Math.abs(d) <= thr && (!bx || Math.abs(d) < Math.abs(bx.d))) bx = { d, at: ox, o } }
    for (const oy of [o.y, o.y + o.h / 2, o.y + o.h]) for (const my of ys) { const d = oy - my; if (Math.abs(d) <= thr && (!by || Math.abs(d) < Math.abs(by.d))) by = { d, at: oy, o } }
  }
  let dx = bx ? bx.d : 0, dy = by ? by.d : 0
  if (!bx && grid) dx = Math.round(m.x / grid) * grid - m.x
  if (!by && grid) dy = Math.round(m.y / grid) * grid - m.y
  const sr = { x: m.x + dx, y: m.y + dy, w: m.w, h: m.h }; const guides: Guide[] = []
  if (bx) { const lo = Math.min(sr.y, bx.o.y), hi = Math.max(sr.y + sr.h, bx.o.y + bx.o.h); guides.push({ x1: bx.at, y1: lo, x2: bx.at, y2: hi }) }
  if (by) { const lo = Math.min(sr.x, by.o.x), hi = Math.max(sr.x + sr.w, by.o.x + by.o.w); guides.push({ x1: lo, y1: by.at, x2: hi, y2: by.at }) }
  return { dx, dy, guides }
}

export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
export const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
export function handlePos(r: Rect, h: Handle): Pt {
  const x = h.includes('w') ? r.x : h.includes('e') ? r.x + r.w : r.x + r.w / 2
  const y = h.includes('n') ? r.y : h.includes('s') ? r.y + r.h : r.y + r.h / 2
  return { x, y }
}
export function resizeRect(r: Rect, h: Handle, dx: number, dy: number, keep: boolean, min = 12): Rect {
  let x1 = r.x, y1 = r.y, x2 = r.x + r.w, y2 = r.y + r.h
  if (h.includes('w')) x1 = Math.min(x1 + dx, x2 - min)
  if (h.includes('e')) x2 = Math.max(x2 + dx, x1 + min)
  if (h.includes('n')) y1 = Math.min(y1 + dy, y2 - min)
  if (h.includes('s')) y2 = Math.max(y2 + dy, y1 + min)
  if (keep && r.w && r.h) {
    const ar = r.w / r.h; const w = x2 - x1, hh = y2 - y1
    if (h.length === 2) {
      const nw = Math.max(w, hh * ar), nh = nw / ar
      if (h.includes('w')) x1 = x2 - nw; else x2 = x1 + nw
      if (h.includes('n')) y1 = y2 - nh; else y2 = y1 + nh
    } else if (h === 'n' || h === 's') { const nw = hh * ar; const cx = r.x + r.w / 2; x1 = cx - nw / 2; x2 = cx + nw / 2 }
    else { const nh = w / ar; const cy = r.y + r.h / 2; y1 = cy - nh / 2; y2 = cy + nh / 2 }
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
}

export type AlignMode = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'
export function alignDeltas(rs: Rect[], mode: AlignMode): Pt[] {
  const u = unionRect(rs); if (!u) return []
  return rs.map((r) => {
    switch (mode) {
      case 'left': return { x: u.x - r.x, y: 0 }
      case 'right': return { x: u.x + u.w - (r.x + r.w), y: 0 }
      case 'center': return { x: u.x + u.w / 2 - (r.x + r.w / 2), y: 0 }
      case 'top': return { x: 0, y: u.y - r.y }
      case 'bottom': return { x: 0, y: u.y + u.h - (r.y + r.h) }
      case 'middle': return { x: 0, y: u.y + u.h / 2 - (r.y + r.h / 2) }
    }
  })
}
export function distributeDeltas(rs: Rect[], axis: 'h' | 'v'): Pt[] {
  const out = rs.map(() => ({ x: 0, y: 0 })); if (rs.length < 3) return out
  const idx = rs.map((_, i) => i).sort((a, b) => (axis === 'h' ? rs[a].x - rs[b].x : rs[a].y - rs[b].y))
  const first = rs[idx[0]], last = rs[idx[idx.length - 1]]
  const size = (r: Rect) => (axis === 'h' ? r.w : r.h)
  const span = axis === 'h' ? last.x + last.w - first.x : last.y + last.h - first.y
  const gap = (span - idx.reduce((s, i) => s + size(rs[i]), 0)) / (idx.length - 1)
  let pos = (axis === 'h' ? first.x : first.y) + size(first) + gap
  for (let k = 1; k < idx.length - 1; k++) { const r = rs[idx[k]]; const cur = axis === 'h' ? r.x : r.y; out[idx[k]] = axis === 'h' ? { x: pos - cur, y: 0 } : { x: 0, y: pos - cur }; pos += size(r) + gap }
  return out
}

// ---------- freehand ----------
const smooth = (pts: Pt[]): string => {
  if (pts.length < 3) return pts.map((p, i) => `${i ? 'L' : 'M'}${r2(p.x)} ${r2(p.y)}`).join(' ')
  let d = `M${r2(pts[0].x)} ${r2(pts[0].y)}`
  for (let i = 1; i < pts.length - 1; i++) { const m = mid(pts[i], pts[i + 1]); d += ` Q${r2(pts[i].x)} ${r2(pts[i].y)} ${r2(m.x)} ${r2(m.y)}` }
  const l = pts[pts.length - 1]; return d + ` L${r2(l.x)} ${r2(l.y)}`
}
export function strokePoints(pts: number[]): Pt[] { const o: Pt[] = []; for (let i = 0; i < pts.length; i += 3) o.push({ x: pts[i], y: pts[i + 1] }); return o }
/** Centre-line path for highlighter / plain strokes. */
export const strokeLine = (pts: number[]) => { const p = strokePoints(pts); return p.length === 1 ? `M${r2(p[0].x)} ${r2(p[0].y)} L${r2(p[0].x + 0.01)} ${r2(p[0].y)}` : smooth(p) }
/** Variable-width ink outline: tapered ends, pressure aware. Returns a filled path. */
export function strokeOutline(pts: number[], size: number): string {
  const p = strokePoints(pts); const n = p.length
  if (n === 0) return ''
  const rad = (i: number) => { const pr = pts[i * 3 + 2]; const f = pr === 0.5 || !pr ? 1 : 0.55 + pr * 0.9; const taper = Math.min(1, 0.45 + 0.55 * Math.min(i, n - 1 - i) / 4); return Math.max(0.6, (size / 2) * f * taper) }
  if (n === 1) { const r = Math.max(size / 2, 0.8); return `M${r2(p[0].x - r)} ${r2(p[0].y)} a${r2(r)} ${r2(r)} 0 1 0 ${r2(r * 2)} 0 a${r2(r)} ${r2(r)} 0 1 0 ${r2(-r * 2)} 0Z` }
  const L: Pt[] = [], R: Pt[] = []
  for (let i = 0; i < n; i++) {
    const a = p[Math.max(0, i - 1)], b = p[Math.min(n - 1, i + 1)]; const dx = b.x - a.x, dy = b.y - a.y; const l = Math.hypot(dx, dy) || 1
    const nx = -dy / l, ny = dx / l; const r = rad(i)
    L.push({ x: p[i].x + nx * r, y: p[i].y + ny * r }); R.push({ x: p[i].x - nx * r, y: p[i].y - ny * r })
  }
  const lastR = rad(n - 1), firstR = rad(0)
  const left = smooth(L), right = smooth(R.slice().reverse()).replace(/^M[^QL]*/, '')
  const rEnd = R[n - 1], lStart = L[0]
  return `${left} A${r2(lastR)} ${r2(lastR)} 0 0 1 ${r2(rEnd.x)} ${r2(rEnd.y)} ${right.startsWith(' ') ? right : ' ' + right} A${r2(firstR)} ${r2(firstR)} 0 0 1 ${r2(lStart.x)} ${r2(lStart.y)} Z`
}

// ---------- hand-drawn look ----------
function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
export const hashSeed = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
export function roughPath(poly: Pt[], closed: boolean, seed: number, amp = 1.8): string {
  const rnd = rng(seed); const n = poly.length; let d = ''
  const segs = closed ? n : n - 1
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < segs; i++) {
      const a = poly[i], b = poly[(i + 1) % n]; const l = dist(a, b); if (l < 0.5) continue
      const k = Math.min(amp, l * 0.09 + 0.2); const j = () => (rnd() - 0.5) * 2 * k
      const nx = -(b.y - a.y) / l, ny = (b.x - a.x) / l; const off = (rnd() - 0.5) * k * 2.2
      const c = { x: (a.x + b.x) / 2 + nx * off, y: (a.y + b.y) / 2 + ny * off }
      d += `M${r2(a.x + j())} ${r2(a.y + j())} Q${r2(c.x)} ${r2(c.y)} ${r2(b.x + j())} ${r2(b.y + j())} `
    }
  }
  return d.trim()
}
export const polyPathD = (pts: Pt[]) => `M${pts.map((p) => `${r2(p.x)} ${r2(p.y)}`).join(' L')} Z`
