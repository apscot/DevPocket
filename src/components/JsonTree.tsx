import { memo, useCallback, useMemo, useState, useRef, useEffect } from 'react'
import { ChevronDown, ChevronRight, Copy } from 'lucide-react'
import { pathKey, typeOf, type JType } from '@/lib/json'
import { copyText } from '@/lib/util'
import { cn } from '@/lib/cn'
import { Hl } from './kit'

interface Row { path: string; key: string | number | null; value: unknown; depth: number; type: JType; open: boolean; expandable: boolean; count: number }
const ROW_H = 28
const typeColor: Record<JType, string> = { string: 'text-success', number: 'text-primary', boolean: 'text-warning', null: 'text-muted-foreground', object: 'text-foreground', array: 'text-foreground' }
const badge: Record<JType, string> = { string: 'bg-success/10 text-success', number: 'bg-primary/10 text-primary', boolean: 'bg-warning/10 text-warning', null: 'bg-muted text-muted-foreground', object: 'bg-accent text-foreground', array: 'bg-accent text-foreground' }

const childCount = (v: unknown) => (Array.isArray(v) ? v.length : v && typeof v === 'object' ? Object.keys(v).length : 0)

export function collectContainers(root: unknown, maxDepth = Infinity, cap = 60000): Set<string> {
  const out = new Set<string>(); let n = 0
  const walk = (v: unknown, p: string, d: number) => {
    if (n > cap || d > maxDepth || !v || typeof v !== 'object') return
    out.add(p); n++
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, pathKey(p, i), d + 1))
    else for (const [k, x] of Object.entries(v)) walk(x, pathKey(p, k), d + 1)
  }
  walk(root, '$', 0); return out
}

function findMatches(root: unknown, q: string, cap = 20000) {
  const matches = new Set<string>(); const open = new Set<string>()
  if (!q) return { matches, open }
  const ql = q.toLowerCase()
  const walk = (v: unknown, key: string | number | null, p: string, anc: string[]) => {
    if (matches.size >= cap) return
    const hit = (key !== null && String(key).toLowerCase().includes(ql)) || (v === null || typeof v !== 'object') && String(v).toLowerCase().includes(ql)
    if (hit) { matches.add(p); anc.forEach((a) => open.add(a)) }
    if (v && typeof v === 'object') {
      const next = [...anc, p]
      if (Array.isArray(v)) v.forEach((x, i) => walk(x, i, pathKey(p, i), next))
      else for (const [k, x] of Object.entries(v)) walk(x, k, pathKey(p, k), next)
    }
  }
  walk(root, null, '$', [])
  return { matches, open }
}

function flatten(root: unknown, expanded: Set<string>, forced: Set<string>): Row[] {
  const rows: Row[] = []
  const stack: { v: unknown; key: string | number | null; path: string; depth: number }[] = [{ v: root, key: null, path: '$', depth: 0 }]
  while (stack.length) {
    const { v, key, path, depth } = stack.pop()!
    const type = typeOf(v); const expandable = type === 'object' || type === 'array'
    const count = expandable ? childCount(v) : 0
    const open = expandable && count > 0 && (expanded.has(path) || forced.has(path))
    rows.push({ path, key, value: v, depth, type, open, expandable: expandable && count > 0, count })
    if (open) {
      if (Array.isArray(v)) for (let i = v.length - 1; i >= 0; i--) stack.push({ v: v[i], key: i, path: pathKey(path, i), depth: depth + 1 })
      else { const ks = Object.keys(v as object); for (let i = ks.length - 1; i >= 0; i--) stack.push({ v: (v as Record<string, unknown>)[ks[i]], key: ks[i], path: pathKey(path, ks[i]), depth: depth + 1 }) }
    }
  }
  return rows
}

const preview = (r: Row) => {
  if (r.type === 'object') return r.count ? '' : '{}'
  if (r.type === 'array') return r.count ? '' : '[]'
  if (r.type === 'string') return JSON.stringify(r.value)
  return String(r.value)
}

const TreeRow = memo(function TreeRow({ r, variant, q, isMatch, toggle, onCopy }: { r: Row; variant: 'viewer' | 'graph'; q: string; isMatch: boolean; toggle: (p: string) => void; onCopy: (t: string, what: string) => void }) {
  const graph = variant === 'graph'
  return (
    <div className={cn('group flex items-center gap-1 pr-2 hover:bg-muted/60', isMatch && 'bg-warning/10')} style={{ height: ROW_H, paddingLeft: 8 + r.depth * 18 }} data-path={r.path}>
      {graph && r.depth > 0 && <span className="h-px w-2 shrink-0 bg-border" aria-hidden />}
      {r.expandable ? (
        <button aria-label={r.open ? 'Collapse' : 'Expand'} aria-expanded={r.open} onClick={() => toggle(r.path)} className="cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-muted">{r.open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>
      ) : <span className="w-[18px] shrink-0" />}
      {r.key !== null && <span className={cn('mono shrink-0', typeof r.key === 'number' ? 'text-muted-foreground' : 'text-primary')}><Hl text={String(r.key)} q={q} />{!graph && <span className="text-muted-foreground">:</span>}</span>}
      {graph ? (
        <span className={cn('mono flex min-w-0 items-center gap-1.5 truncate rounded border px-1.5 text-xs', r.expandable && 'bg-card')}>
          <span className={cn('rounded px-1 text-[10px] uppercase', badge[r.type])}>{r.type}</span>
          {r.expandable ? <span className="text-muted-foreground">{r.count} {r.type === 'array' ? 'items' : 'keys'}</span> : <span className={cn('truncate', typeColor[r.type])}><Hl text={preview(r)} q={q} /></span>}
        </span>
      ) : (
        <>
          {r.expandable ? <span className="mono text-xs text-muted-foreground">{r.type === 'array' ? `[${r.count}]` : `{${r.count}}`}</span> : <span className={cn('mono min-w-0 truncate', typeColor[r.type])}><Hl text={preview(r)} q={q} /></span>}
          <span className={cn('ml-1 hidden shrink-0 rounded px-1 text-[10px] uppercase sm:inline', badge[r.type])}>{r.type}</span>
        </>
      )}
      <span className="ml-auto flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
        <button title="Copy JSON path" aria-label={`Copy path ${r.path}`} onClick={() => onCopy(r.path, 'path')} className="cursor-pointer rounded px-1 text-[10px] text-muted-foreground hover:bg-muted">path</button>
        <button title="Copy value" aria-label="Copy value" onClick={() => onCopy(typeof r.value === 'string' ? r.value : JSON.stringify(r.value, null, 2), 'value')} className="cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-muted"><Copy size={12} /></button>
      </span>
    </div>
  )
})

export function JsonTree({ data, variant = 'viewer', search = '', height = 520, initialDepth = 1 }: { data: unknown; variant?: 'viewer' | 'graph'; search?: string; height?: number; initialDepth?: number }) {
  const [expanded, setExpanded] = useState<Set<string>>(() => collectContainers(data, initialDepth - 1))
  const [scroll, setScroll] = useState(0)
  const [toast, setToast] = useState('')
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => { setExpanded(collectContainers(data, initialDepth - 1)) }, [data, initialDepth])
  const { matches, open } = useMemo(() => findMatches(data, search), [data, search])
  const rows = useMemo(() => flatten(data, expanded, open), [data, expanded, open])
  const toggle = useCallback((p: string) => setExpanded((s) => { const n = new Set(s); if (n.has(p)) n.delete(p); else n.add(p); return n }), [])
  const onCopy = useCallback(async (t: string, what: string) => { await copyText(t); setToast(`Copied ${what}`); setTimeout(() => setToast(''), 1200) }, [])
  const start = Math.max(0, Math.floor(scroll / ROW_H) - 10)
  const end = Math.min(rows.length, Math.ceil((scroll + height) / ROW_H) + 10)
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
        <button className="cursor-pointer rounded border px-2 py-1 hover:bg-muted" onClick={() => setExpanded(collectContainers(data))}>Expand all</button>
        <button className="cursor-pointer rounded border px-2 py-1 hover:bg-muted" onClick={() => setExpanded(new Set())}>Collapse all</button>
        {[1, 2, 3, 4].map((n) => <button key={n} className="cursor-pointer rounded border px-2 py-1 hover:bg-muted" onClick={() => setExpanded(collectContainers(data, n - 1))}>Level {n}</button>)}
        <span className="ml-auto text-muted-foreground" aria-live="polite">{search ? `${matches.size} match${matches.size === 1 ? '' : 'es'} · ` : ''}{rows.length.toLocaleString()} rows {toast && <b className="text-success">· {toast}</b>}</span>
      </div>
      <div ref={box} className="scroll-thin overflow-auto rounded-md border bg-background" style={{ height }} onScroll={(e) => setScroll(e.currentTarget.scrollTop)} role="tree">
        <div style={{ height: rows.length * ROW_H, position: 'relative' }}>
          <div style={{ position: 'absolute', top: start * ROW_H, left: 0, minWidth: '100%' }}>
            {rows.slice(start, end).map((r) => <TreeRow key={r.path} r={r} variant={variant} q={search} isMatch={matches.has(r.path)} toggle={toggle} onCopy={onCopy} />)}
          </div>
        </div>
      </div>
    </div>
  )
}
