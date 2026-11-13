import type { ArrowKind, EdgeEl, El, Pt, ShapeEl, ShapeKind, Style } from './types'
import { newEdge, newShape } from './scene'
import { measure, lineHeight } from './text'

export interface GNode { id: string; text: string; kind: ShapeKind; style?: Partial<Style>; w?: number; h?: number }
export interface GEdge { from: string; to: string; text?: string; dashed?: boolean; head?: ArrowKind; tail?: ArrowKind; thick?: boolean }
export interface Graph { nodes: GNode[]; edges: GEdge[]; dir: 'TB' | 'LR' | 'BT' | 'RL' }

// ---------- Mermaid flowchart subset ----------
const OPEN: [string, string, ShapeKind, Partial<Style>][] = [
  ['((', '))', 'ellipse', {}], ['([', '])', 'rect', { radius: 999 }], ['[(', ')]', 'cylinder', {}], ['[[', ']]', 'process', {}],
  ['{{', '}}', 'hexagon', {}], ['[/', '/]', 'parallelogram', {}], ['[\\', '\\]', 'parallelogram', {}], ['{', '}', 'diamond', {}], ['[', ']', 'rect', {}], ['(', ')', 'rect', { radius: 14 }],
]
const clean = (t: string) => t.replace(/^["']|["']$/g, '').replace(/<br\s*\/?>/gi, '\n').replace(/&quot;/g, '"').replace(/<[^>]+>/g, '').trim()

export function parseMermaidFlowchart(src: string): Graph {
  const lines = src.replace(/\r/g, '').split('\n').map((l) => l.replace(/%%.*$/, '').trim()).filter(Boolean)
  const head = /^(flowchart|graph)\s*(TD|TB|LR|RL|BT)?\b/i.exec(lines[0] ?? '')
  if (!head) throw new Error('Only Mermaid flowcharts are supported here: start with "flowchart TD" or "graph LR".')
  const dir = ((head[2] ?? 'TB').toUpperCase().replace('TD', 'TB')) as Graph['dir']
  const nodes = new Map<string, GNode>(); const edges: GEdge[] = []

  const readNode = (s: string): { id: string; rest: string } | null => {
    const m = /^([^\s\-=.<>[\](){}|"';&]+)/.exec(s); if (!m) return null
    const id = m[1]; let rest = s.slice(id.length)
    for (const [o, c, kind, st] of OPEN) {
      if (rest.startsWith(o)) {
        const end = rest.indexOf(c, o.length); if (end < 0) continue
        const text = clean(rest.slice(o.length, end)); rest = rest.slice(end + c.length)
        const prev = nodes.get(id); nodes.set(id, { ...(prev ?? { id }), id, text, kind, style: st }); return { id, rest }
      }
    }
    if (!nodes.has(id)) nodes.set(id, { id, text: id, kind: 'rect' })
    return { id, rest }
  }
  const rest0 = lines[0].slice(head[0].length).replace(/^\s*;?\s*/, '')
  for (const stmt of [...(rest0 ? [rest0] : []), ...lines.slice(1)].flatMap((l) => l.split(/;(?![^[\]]*\])/)).map((s) => s.trim()).filter(Boolean)) {
    if (/^(subgraph|end|style|classDef|class|linkStyle|click|direction|accTitle|accDescr)\b/i.test(stmt)) continue
    let s = stmt; const first = readNode(s); if (!first) continue
    s = first.rest.trim(); let prev = first.id
    for (let guard = 0; s && guard < 50; guard++) {
      let label = ''; let op = ''
      const m1 = /^(<?)(-->|---|-\.->|-\.-|==>|===|--[xo]|~~~)/.exec(s)
      const m2 = /^--\s+([^-=>]+?)\s+(-->|---)/.exec(s) ?? /^==\s+([^-=>]+?)\s+(==>|===)/.exec(s) ?? /^-\.\s+([^-=>]+?)\s+(\.->|\.-)/.exec(s)
      if (m2) { label = clean(m2[1]); op = m2[2]; s = s.slice(m2[0].length).trim() }
      else if (m1) { op = m1[2]; s = s.slice(m1[0].length).trim() }
      else break
      const lm = /^\|([^|]*)\|/.exec(s); if (lm) { label = clean(lm[1]); s = s.slice(lm[0].length).trim() }
      const nxt = readNode(s); if (!nxt) break
      edges.push({ from: prev, to: nxt.id, text: label || undefined, dashed: op.includes('.') || op === '~~~', thick: op.includes('='), head: op.endsWith('>') ? 'triangle' : op.endsWith('x') ? 'bar' : op.endsWith('o') ? 'dot' : 'none' })
      prev = nxt.id; s = nxt.rest.trim()
    }
  }
  if (!nodes.size) throw new Error('No nodes found in the flowchart.')
  return { nodes: [...nodes.values()], edges, dir }
}

// ---------- layered layout ----------
export function sizeFor(n: GNode): { w: number; h: number } {
  if (n.w && n.h) return { w: n.w, h: n.h }
  const st = { fs: 16, font: 'sans' as const, bold: false, italic: false }
  const lines = n.text.split('\n'); const tw = Math.max(...lines.map((l) => measure(l, st)), 20)
  const th = lines.length * lineHeight(16)
  let w = Math.max(110, Math.ceil(tw + 36)), h = Math.max(56, th + 28)
  if (n.kind === 'diamond') { w = Math.max(130, tw * 1.6 + 30); h = Math.max(80, th * 2 + 30) }
  if (n.kind === 'ellipse') { w = Math.max(100, tw * 1.35 + 30); h = Math.max(64, th + 40) }
  if (n.kind === 'hexagon' || n.kind === 'parallelogram') w += 30
  if (n.kind === 'cylinder') h = Math.max(h, 76)
  return { w: Math.ceil(w / 10) * 10, h: Math.ceil(h / 10) * 10 }
}

/** Sugiyama-style layering: cycle removal, longest-path ranks, barycenter ordering, compacted coordinates. */
export function layeredLayout(g: Graph, gapMain = 80, gapCross = 40): Map<string, Pt & { w: number; h: number }> {
  const ids = g.nodes.map((n) => n.id); const idx = new Map(ids.map((id, i) => [id, i]))
  // DFS to drop back edges (cycles)
  const state = new Array(ids.length).fill(0); const fwd: [number, number][] = []
  const adj: number[][] = ids.map(() => [])
  for (const e of g.edges) { const a = idx.get(e.from), b = idx.get(e.to); if (a === undefined || b === undefined || a === b) continue; adj[a].push(b) }
  const visit = (u: number) => { state[u] = 1; for (const v of adj[u]) { if (state[v] === 1) continue; fwd.push([u, v]); if (state[v] === 0) visit(v) } state[u] = 2 }
  for (let i = 0; i < ids.length; i++) if (state[i] === 0) visit(i)
  const seenPair = new Set<string>(); const E: [number, number][] = []
  for (const [a, b] of fwd) { const k = `${a}>${b}`; if (!seenPair.has(k)) { seenPair.add(k); E.push([a, b]) } }
  const nIn: number[][] = ids.map(() => []), nOut: number[][] = ids.map(() => [])
  for (const [a, b] of E) { nOut[a].push(b); nIn[b].push(a) }
  const rank = new Array(ids.length).fill(0)
  const indeg = nIn.map((x) => x.length); const queue = ids.map((_, i) => i).filter((i) => indeg[i] === 0)
  for (let h = 0; h < queue.length; h++) { const u = queue[h]; for (const v of nOut[u]) { rank[v] = Math.max(rank[v], rank[u] + 1); if (--indeg[v] === 0) queue.push(v) } }
  const maxRank = Math.max(0, ...rank)
  const layers: number[][] = Array.from({ length: maxRank + 1 }, () => [])
  for (let i = 0; i < ids.length; i++) layers[rank[i]].push(i)
  const pos = new Array(ids.length).fill(0); layers.forEach((l) => l.forEach((n, i) => { pos[n] = i }))
  const sweep = (down: boolean) => {
    const order = down ? layers.slice(1) : layers.slice(0, -1).reverse()
    for (const L of order) {
      const bary = new Map<number, number>()
      for (const n of L) { const nb = down ? nIn[n] : nOut[n]; bary.set(n, nb.length ? nb.reduce((s, x) => s + pos[x], 0) / nb.length : pos[n]) }
      L.sort((a, b) => (bary.get(a) as number) - (bary.get(b) as number) || pos[a] - pos[b]); L.forEach((n, i) => { pos[n] = i })
    }
  }
  for (let i = 0; i < 4; i++) { sweep(true); sweep(false) }
  const horizontal = g.dir === 'LR' || g.dir === 'RL'
  const dims = g.nodes.map(sizeFor)
  const main = (i: number) => (horizontal ? dims[i].w : dims[i].h), cross = (i: number) => (horizontal ? dims[i].h : dims[i].w)
  const crossPos = new Array(ids.length).fill(0)
  const layerSize = layers.map((L) => (L.length ? L.reduce((s, n) => s + cross(n), 0) + (L.length - 1) * gapCross : 0))
  const widest = Math.max(0, ...layerSize)
  layers.forEach((L, li) => { let c = (widest - layerSize[li]) / 2; for (const n of L) { crossPos[n] = c; c += cross(n) + gapCross } })
  // pull nodes toward the mean of their neighbours while keeping order and spacing
  for (let it = 0; it < 6; it++) {
    for (const down of [true, false]) {
      const seq = down ? layers.slice(1) : layers.slice(0, -1).reverse()
      for (const L of seq) {
        for (let k = 0; k < L.length; k++) {
          const n = L[k]; const nb = down ? nIn[n] : nOut[n]; if (!nb.length) continue
          const want = nb.reduce((s, x) => s + crossPos[x] + cross(x) / 2, 0) / nb.length - cross(n) / 2
          const lo = k ? crossPos[L[k - 1]] + cross(L[k - 1]) + gapCross : -Infinity
          const hi = k < L.length - 1 ? crossPos[L[k + 1]] - cross(n) - gapCross : Infinity
          crossPos[n] = Math.min(hi, Math.max(lo, want))
        }
      }
    }
  }
  const minC = Math.min(...crossPos)
  const layerMain = layers.map((L) => Math.max(0, ...L.map(main)))
  const offs: number[] = []; let acc = 0; layerMain.forEach((m, i) => { offs[i] = acc; acc += m + gapMain })
  const total = acc - gapMain; const res = new Map<string, Pt & { w: number; h: number }>()
  for (let i = 0; i < ids.length; i++) {
    let m = offs[rank[i]] + (layerMain[rank[i]] - main(i)) / 2; const c = crossPos[i] - minC
    if (g.dir === 'BT' || g.dir === 'RL') m = total - m - main(i)
    res.set(ids[i], horizontal ? { x: m, y: c, w: dims[i].w, h: dims[i].h } : { x: c, y: m, w: dims[i].w, h: dims[i].h })
  }
  return res
}

export function graphToEls(g: Graph, origin: Pt = { x: 0, y: 0 }): El[] {
  const pos = layeredLayout(g); const els: El[] = []; const byId = new Map<string, ShapeEl>()
  for (const n of g.nodes) {
    const p = pos.get(n.id) as Pt & { w: number; h: number }
    const st: Partial<Style> = { fill: '#eef2ff', stroke: '#4f46e5', ...n.style }
    const sh = newShape(n.kind, Math.round(p.x + origin.x), Math.round(p.y + origin.y), p.w, p.h, { text: n.text, s: st }); byId.set(n.id, sh); els.push(sh)
  }
  for (const e of g.edges) {
    const a = byId.get(e.from), b = byId.get(e.to); if (!a || !b) continue
    els.push(newEdge({ id: a.id }, { id: b.id }, { route: 'orth', text: e.text ?? '', head: e.head ?? 'triangle', tail: e.tail ?? 'none', s: { stroke: '#475569', sw: e.thick ? 3 : 2, dash: e.dashed ? 'dashed' : 'solid', fs: 13 } }))
  }
  return els
}

/** Re-layout existing shapes (and the edges between them) without touching other elements. */
export function autoLayout(els: El[], ids: string[] | null, dir: Graph['dir']): El[] {
  const set = ids ? new Set(ids) : null
  const shapes = els.filter((e): e is ShapeEl => e.t === 'shape' && (!set || set.has(e.id)))
  if (shapes.length < 2) return els
  const inSet = new Set(shapes.map((s) => s.id))
  const edges = els.filter((e): e is EdgeEl => e.t === 'edge' && !!e.a.id && !!e.b.id && inSet.has(e.a.id) && inSet.has(e.b.id))
  const g: Graph = { dir, nodes: shapes.map((s) => ({ id: s.id, text: s.text, kind: s.kind, w: s.w, h: s.h })), edges: edges.map((e) => ({ from: e.a.id as string, to: e.b.id as string })) }
  const pos = layeredLayout(g)
  const minX = Math.min(...shapes.map((s) => s.x)), minY = Math.min(...shapes.map((s) => s.y))
  return els.map((e) => { const p = e.t === 'shape' ? pos.get(e.id) : undefined; if (p) return { ...e, x: Math.round(p.x + minX), y: Math.round(p.y + minY) }; if (e.t === 'edge' && edges.includes(e)) return { ...e, a: { id: e.a.id }, b: { id: e.b.id }, bend: 0.5 }; return e })
}

// ---------- starter templates ----------
const T = (kind: ShapeKind, text: string, id: string, style?: Partial<Style>): GNode => ({ id, text, kind, style })
export const TEMPLATES: { name: string; description: string; build: () => El[] }[] = [
  {
    name: 'Flowchart', description: 'Process with a decision and loop-back',
    build: () => graphToEls({ dir: 'TB', nodes: [T('rect', 'Start', 's', { radius: 999, fill: '#dcfce7', stroke: '#16a34a' }), T('rect', 'Receive request', 'a'), T('diamond', 'Valid?', 'd', { fill: '#fef9c3', stroke: '#ca8a04' }), T('rect', 'Process order', 'p'), T('rect', 'Return error', 'e', { fill: '#fee2e2', stroke: '#dc2626' }), T('rect', 'End', 'z', { radius: 999, fill: '#dcfce7', stroke: '#16a34a' })], edges: [{ from: 's', to: 'a' }, { from: 'a', to: 'd' }, { from: 'd', to: 'p', text: 'yes' }, { from: 'd', to: 'e', text: 'no' }, { from: 'p', to: 'z' }, { from: 'e', to: 'z' }] }),
  },
  {
    name: 'Microservices', description: 'Gateway, services, queue and database',
    build: () => graphToEls({ dir: 'LR', nodes: [T('rect', 'Web app', 'web', { fill: '#dbeafe', stroke: '#2563eb' }), T('rect', 'API Gateway', 'gw', { fill: '#ede9fe', stroke: '#7c3aed' }), T('rect', 'Orders', 'o'), T('rect', 'Payments', 'p'), T('rect', 'Users', 'u'), T('rect', 'Message queue', 'q', { fill: '#ffedd5', stroke: '#ea580c' }), T('cylinder', 'Orders DB', 'odb', { fill: '#f1f5f9', stroke: '#475569' }), T('cylinder', 'Users DB', 'udb', { fill: '#f1f5f9', stroke: '#475569' })], edges: [{ from: 'web', to: 'gw' }, { from: 'gw', to: 'o' }, { from: 'gw', to: 'p' }, { from: 'gw', to: 'u' }, { from: 'o', to: 'q' }, { from: 'p', to: 'q' }, { from: 'o', to: 'odb' }, { from: 'u', to: 'udb' }] }),
  },
  {
    name: 'Org chart', description: 'Hierarchy of roles',
    build: () => graphToEls({ dir: 'TB', nodes: [T('rect', 'CEO', 'c', { fill: '#dbeafe', stroke: '#2563eb', radius: 8 }), T('rect', 'CTO', 't', { radius: 8 }), T('rect', 'CFO', 'f', { radius: 8 }), T('rect', 'COO', 'o', { radius: 8 }), T('rect', 'Engineering', 'e', { fill: '#f1f5f9', stroke: '#64748b', radius: 8 }), T('rect', 'Data', 'd', { fill: '#f1f5f9', stroke: '#64748b', radius: 8 }), T('rect', 'Finance', 'fi', { fill: '#f1f5f9', stroke: '#64748b', radius: 8 }), T('rect', 'Operations', 'op', { fill: '#f1f5f9', stroke: '#64748b', radius: 8 })], edges: [{ from: 'c', to: 't' }, { from: 'c', to: 'f' }, { from: 'c', to: 'o' }, { from: 't', to: 'e' }, { from: 't', to: 'd' }, { from: 'f', to: 'fi' }, { from: 'o', to: 'op' }].map((e) => ({ ...e, head: 'none' as ArrowKind })) }),
  },
  {
    name: 'CI/CD pipeline', description: 'Build, test, deploy stages',
    build: () => graphToEls({ dir: 'LR', nodes: [T('chevron', 'Commit', 'a', { fill: '#dbeafe', stroke: '#2563eb' }), T('chevron', 'Build', 'b', { fill: '#ede9fe', stroke: '#7c3aed' }), T('chevron', 'Test', 'c', { fill: '#fef9c3', stroke: '#ca8a04' }), T('chevron', 'Staging', 'd', { fill: '#ffedd5', stroke: '#ea580c' }), T('chevron', 'Production', 'e', { fill: '#dcfce7', stroke: '#16a34a' })], edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'd' }, { from: 'd', to: 'e' }] }),
  },
]
