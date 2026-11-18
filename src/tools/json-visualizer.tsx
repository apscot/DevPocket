import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Expand, Maximize2, Minimize2, ZoomIn, ZoomOut } from 'lucide-react'
import { Button, CopyButton, Empty, InputPane, Notice, Panel, SearchBox, Select, useDebounced } from '@/components/kit'
import { buildGraph, rowY, ROW_H, PAD, CHAR_W, type GNode } from '@/lib/graph'
import { useParsedJson } from '@/hooks/useParsedJson'
import { useFullscreen } from '@/hooks/useFullscreen'
import { cn } from '@/lib/cn'
import { downloadText } from '@/lib/util'
import { SAMPLE_JSON } from '@/lib/samples'

const H0 = 640
const colors: Record<string, string> = { string: 'var(--success)', number: 'var(--primary)', boolean: 'var(--warning)', null: 'var(--muted-foreground)', object: 'var(--foreground)', array: 'var(--foreground)' }
export default function JsonVisualizer() {
  const [text, setText] = useState(''); const [q, setQ] = useState(''); const dq = useDebounced(q, 200); const [depth, setDepth] = useState('99')
  const [sel, setSel] = useState<number | null>(null)
  const fs = useFullscreen(); const [vh, setVh] = useState(() => window.innerHeight)
  useEffect(() => { const f = () => setVh(window.innerHeight); window.addEventListener('resize', f); document.addEventListener('fullscreenchange', f); return () => { window.removeEventListener('resize', f); document.removeEventListener('fullscreenchange', f) } }, [])
  const H = fs.on ? Math.max(320, vh - 150) : H0
  const { data, error, empty } = useParsedJson(text)
  const graph = useMemo(() => (empty || error ? null : buildGraph(data, { maxDepth: Number(depth) })), [data, empty, error, depth])
  const [view, setView] = useState({ x: 20, y: 20, k: 1 }); const box = useRef<HTMLDivElement>(null); const svg = useRef<SVGSVGElement>(null)
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)
  const fit = useCallback(() => { if (!graph || !box.current) return; const w = box.current.clientWidth; const k = Math.min(1, (w - 40) / Math.max(1, graph.width), (H - 40) / Math.max(1, graph.height)); setView({ k, x: 20, y: Math.max(20, (H - graph.height * k) / 2) }) }, [graph, H])
  useEffect(() => { fit(); setSel(null) }, [fit])
  useEffect(() => {
    const el = svg.current; if (!el) return
    const wheel = (e: WheelEvent) => { e.preventDefault(); const r = el.getBoundingClientRect(); const mx = e.clientX - r.left, my = e.clientY - r.top; setView((v) => { const k = Math.min(3, Math.max(0.05, v.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12))); return { k, x: mx - ((mx - v.x) / v.k) * k, y: my - ((my - v.y) / v.k) * k } }) }
    el.addEventListener('wheel', wheel, { passive: false }); return () => el.removeEventListener('wheel', wheel)
  }, [graph])
  const zoom = (f: number) => setView((v) => { const w = (box.current?.clientWidth ?? 800) / 2, h = H / 2; const k = Math.min(3, Math.max(0.05, v.k * f)); return { k, x: w - ((w - v.x) / v.k) * k, y: h - ((h - v.y) / v.k) * k } })
  const match = (n: GNode) => !dq || n.rows.some((r) => (r.key + ' ' + (r.value ?? '')).toLowerCase().includes(dq.toLowerCase()))
  const matches = graph ? graph.nodes.filter(match).length : 0
  const selected = graph && sel !== null ? graph.nodes[sel] : null
  const exportSvg = () => { if (!svg.current) return; const cs = getComputedStyle(document.documentElement); let s = new XMLSerializer().serializeToString(svg.current).replace(/var\((--[\w-]+)\)/g, (_m, v) => cs.getPropertyValue(v).trim()); downloadText('json-graph.svg', s, 'image/svg+xml') }
  return (
    <div className={cn('grid gap-3', !fs.on && 'lg:grid-cols-[minmax(260px,320px)_1fr]')}>
      {!fs.on && <InputPane value={text} onChange={setText} sample={SAMPLE_JSON} accept=".json" rows={22} />}
      <div ref={fs.ref} className={cn('min-w-0', fs.cls)}>
      <Panel title="Graph" actions={<>
        <SearchBox value={q} onChange={setQ} placeholder="Search nodes" className="w-40" />
        <Select aria-label="Max depth" value={depth} onChange={(e) => setDepth(e.target.value)} className="h-8 w-28"><option value="99">All levels</option>{[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>Depth {d}</option>)}</Select>
        <Button size="icon" aria-label="Zoom out" onClick={() => zoom(1 / 1.25)}><ZoomOut size={14} /></Button><Button size="icon" aria-label="Zoom in" onClick={() => zoom(1.25)}><ZoomIn size={14} /></Button><Button size="icon" aria-label="Fit to screen" onClick={fit}><Maximize2 size={14} /></Button><Button size="icon" aria-label={fs.on ? 'Exit full screen' : 'Full screen'} aria-pressed={fs.on} onClick={() => void fs.toggle()}>{fs.on ? <Minimize2 size={14} /> : <Expand size={14} />}</Button>
        <Button onClick={exportSvg} disabled={!graph}>SVG</Button></>}>
        {error ? <Notice kind="error">{error}</Notice> : !graph ? <Empty>Paste JSON to render it as a node graph. Drag to pan, scroll to zoom, click a node to inspect its path.</Empty> : (<>
          {graph.truncated && <Notice kind="warn" className="mb-2">Large document: some branches are collapsed (node limit or depth). Lower the depth or paste a smaller subset to see everything.</Notice>}
          <div ref={box} className="relative overflow-hidden rounded-md border bg-background" style={{ height: H, backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)', backgroundSize: '18px 18px' }}>
            <svg ref={svg} width="100%" height={H} data-testid="json-graph" className="cursor-grab select-none active:cursor-grabbing"
              onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; (e.target as Element).setPointerCapture?.(e.pointerId) }}
              onPointerMove={(e) => { const d = drag.current; if (d) setView((v) => ({ ...v, x: d.vx + e.clientX - d.x, y: d.vy + e.clientY - d.y })) }} onPointerUp={() => (drag.current = null)}>
              <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
                {graph.edges.map((e, i) => { const a = graph.nodes[e.from], b = graph.nodes[e.to]; const x1 = a.x + a.w, y1 = rowY(a, e.row), x2 = b.x, y2 = b.y + Math.min(b.h / 2, 22); const mx = (x1 + x2) / 2
                  return <path key={i} d={`M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`} fill="none" stroke="var(--input)" strokeWidth={1.5} opacity={match(a) || match(b) ? 1 : 0.3} /> })}
                {graph.nodes.map((n) => (
                  <g key={n.id} transform={`translate(${n.x} ${n.y})`} opacity={match(n) ? 1 : 0.28} onClick={(e) => { e.stopPropagation(); setSel(n.id) }} style={{ cursor: 'pointer' }} data-node={n.id}>
                    <rect width={n.w} height={n.h} rx={8} fill="var(--card)" stroke={sel === n.id || (dq && match(n)) ? 'var(--primary)' : 'var(--border)'} strokeWidth={sel === n.id || (dq && match(n)) ? 2 : 1} />
                    {n.rows.map((r, i) => (
                      <g key={i} transform={`translate(${PAD + 4} ${PAD + i * ROW_H + ROW_H / 2 + 4})`} fontFamily="ui-monospace, Menlo, monospace" fontSize={12}>
                        {r.key !== '' && <text fill="var(--primary)">{r.key}{r.value !== undefined || r.childId === undefined ? ':' : ''}</text>}
                        {r.value !== undefined && <text x={r.key === '' ? 0 : (r.key.length + 1) * CHAR_W} fill={colors[r.vtype ?? 'null']}>{r.value}</text>}
                        {r.childId !== undefined && <text x={n.w - 2 * PAD - 14} fill="var(--muted-foreground)">{n.rows[i] && graph.nodes[r.childId].kind === 'array' ? '[ ]' : '{ }'}</text>}
                      </g>))}
                  </g>))}
              </g>
            </svg>
            <span className="pointer-events-none absolute bottom-2 left-2 rounded bg-card/80 px-2 py-0.5 text-[11px] text-muted-foreground">{graph.nodes.length} nodes · {Math.round(view.k * 100)}%{dq ? ` · ${matches} match` : ''}</span>
          </div>
          {selected && <div className="mt-2 flex flex-wrap items-center gap-2 text-sm"><span className="text-muted-foreground">Selected:</span><code className="mono rounded bg-muted px-1.5" data-testid="selected-path">{selected.path}</code><CopyButton text={selected.path} label="Copy path" /></div>}
        </>)}
      </Panel>
      </div>
    </div>
  )
}
