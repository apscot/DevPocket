import { typeOf, pathKey, type JType } from './json'

export interface GRow { key: string; value?: string; vtype?: JType; childId?: number }
export interface GNode { id: number; path: string; kind: 'object' | 'array' | 'value'; rows: GRow[]; w: number; h: number; x: number; y: number; depth: number }
export interface GEdge { from: number; row: number; to: number }
export interface Graph { nodes: GNode[]; edges: GEdge[]; truncated: boolean; width: number; height: number }
export const ROW_H = 22, PAD = 6, COL_GAP = 90, ROW_GAP = 18, CHAR_W = 7.3
const clip = (s: string, n = 42) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

export function buildGraph(root: unknown, o: { maxNodes?: number; maxRows?: number; maxDepth?: number } = {}): Graph {
  const maxNodes = o.maxNodes ?? 1500, maxRows = o.maxRows ?? 14, maxDepth = o.maxDepth ?? Infinity
  const nodes: GNode[] = [], edges: GEdge[] = []; let truncated = false
  const prim = (v: unknown): Pick<GRow, 'value' | 'vtype'> => { const t = typeOf(v); return { vtype: t, value: t === 'string' ? clip(JSON.stringify(v)) : t === 'array' ? '[]' : t === 'object' ? '{}' : String(v) } }
  const make = (v: unknown, path: string, depth: number): number => {
    const id = nodes.length
    const n: GNode = { id, path, kind: Array.isArray(v) ? 'array' : v && typeof v === 'object' ? 'object' : 'value', rows: [], w: 0, h: 0, x: 0, y: 0, depth }
    nodes.push(n)
    if (n.kind === 'value') n.rows.push({ key: '', ...prim(v) })
    else {
      const list: [string, unknown][] = Array.isArray(v) ? v.map((x, i) => [String(i), x]) : Object.entries(v as object)
      list.forEach(([k, x], i) => {
        if (i >= maxRows) { if (i === maxRows) n.rows.push({ key: '…', value: `+${list.length - maxRows} more`, vtype: 'null' }); return }
        const isC = x !== null && typeof x === 'object' && Object.keys(x as object).length > 0
        if (isC && depth < maxDepth && nodes.length < maxNodes) { const cid = make(x, pathKey(path, Array.isArray(v) ? Number(k) : k), depth + 1); n.rows.push({ key: k, childId: cid }); edges.push({ from: id, row: n.rows.length - 1, to: cid }) }
        else { if (isC) truncated = true; n.rows.push({ key: k, ...(isC ? { value: Array.isArray(x) ? `[${(x as unknown[]).length}]` : `{${Object.keys(x as object).length}}`, vtype: typeOf(x) } : prim(x)) }) }
      })
      if (!list.length) n.rows.push({ key: '', value: Array.isArray(v) ? '[]' : '{}', vtype: 'null' })
    }
    n.w = Math.min(380, Math.max(110, 2 * PAD + CHAR_W * Math.max(...n.rows.map((r) => r.key.length + (r.value ? r.value.length + 2 : r.childId !== undefined ? 6 : 0)))))
    n.h = n.rows.length * ROW_H + 2 * PAD
    return id
  }
  make(root, '$', 0)
  if (nodes.length >= maxNodes) truncated = true
  const colW: number[] = []; nodes.forEach((n) => (colW[n.depth] = Math.max(colW[n.depth] ?? 0, n.w)))
  const colX: number[] = []; colW.forEach((w, d) => (colX[d] = d === 0 ? 0 : colX[d - 1] + colW[d - 1] + COL_GAP))
  const kids = (n: GNode) => n.rows.filter((r) => r.childId !== undefined).map((r) => nodes[r.childId!])
  const place = (n: GNode, top: number): number => {
    n.x = colX[n.depth]
    const ks = kids(n)
    if (!ks.length) { n.y = top; return top + n.h + ROW_GAP }
    let cur = top; for (const k of ks) cur = place(k, cur)
    const mid = (ks[0].y + ks[0].h / 2 + ks[ks.length - 1].y + ks[ks.length - 1].h / 2) / 2
    n.y = Math.max(top, mid - n.h / 2)
    return Math.max(cur, n.y + n.h + ROW_GAP)
  }
  const height = place(nodes[0], 0) - ROW_GAP
  return { nodes, edges, truncated, width: colX[colX.length - 1] + colW[colW.length - 1], height }
}
export const rowY = (n: GNode, r: number) => n.y + PAD + r * ROW_H + ROW_H / 2
