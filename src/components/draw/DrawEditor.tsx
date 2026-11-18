import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUpRight, Circle, Copy, Diamond, Download, Eraser, FilePlus2, FolderOpen, Hand, Highlighter, ImagePlus, Keyboard, LayoutTemplate, Maximize, Minus, MousePointer2, Network, PanelLeft, Pen, Plus, Redo2, Save, Scan,
  Shapes, Share2, Spline, Square, StickyNote, Triangle, Type, Undo2, Wand2, Zap, Printer, Image as ImageIcon, Grid3x3, Magnet, Presentation, ChevronsLeftRight, Maximize2, Minimize2,
} from 'lucide-react'
import type { Doc, EdgeEl, El, End, Node, Pt, Rect, ShapeEl, ShapeKind, Side, Style } from '@/lib/draw/types'
import { FONTS, defaultStyle, emptyDoc, isNode } from '@/lib/draw/types'
import {
  type AlignMode, type Guide, type Handle, HANDLES, NORMAL, SIDES, alignDeltas, anchor, boundsOf, clamp, dist, distributeDeltas, edgeGeo, elRect, handlePos, hitEl, inRect, nearestSide, nodeMap, nodeRect,
  isDarkColor, normRect, padRect, rectsHit, resizeRect, snapRect, textSize, unionRect,
} from '@/lib/draw/geom'
import { cloneEls, expandGroups, groupEls, moveEl, newEdge, newShape, parseDoc, removeEls, reorder, serializeDoc, uid, ungroupEls } from '@/lib/draw/scene'
import { shapeGeom } from '@/lib/draw/shapes'
import { lineHeight, wrap } from '@/lib/draw/text'
import { TEMPLATES, autoLayout, graphToEls, parseMermaidFlowchart } from '@/lib/draw/layout'
import { fromDrawio, toDrawio } from '@/lib/draw/drawio'
import { useFullscreen } from '@/hooks/useFullscreen'
import { svgToPng } from '@/lib/raster'
import { copyText, downloadBlob, downloadText } from '@/lib/util'
import { cn } from '@/lib/cn'
import { SceneDefs, SceneView } from './SceneView'
import { sceneToSvg, printSvg } from './export'
import { Library, Menu, MenuItem, MenuSep, Modal, PropsPanel, IconBtn, STICKY, btn, btnOn, libToShape, type Defaults, type LibItem, type PropsApi } from './Panels'

export type Mode = 'diagram' | 'whiteboard'
type Tool = 'select' | 'hand' | 'pen' | 'highlighter' | 'eraser' | 'laser' | 'line' | 'arrow' | 'connector' | 'text' | 'sticky' | `shape:${ShapeKind}`

type Drag =
  | { t: 'pan'; sx: number; sy: number; vx: number; vy: number }
  | { t: 'move'; ids: Set<string>; start: Pt; orig: El[]; before: El[]; moved: boolean; hitId: string }
  | { t: 'resize'; h: Handle; orig: Node; before: El[] }
  | { t: 'marquee'; start: Pt; base: string[] }
  | { t: 'create'; kind: ShapeKind; start: Pt }
  | { t: 'edge'; a: End; start: Pt; clone?: { id: string; side: Side }; line: boolean; arrow: boolean }
  | { t: 'edgeEnd'; id: string; which: 'a' | 'b'; before: El[] }
  | { t: 'bend'; id: string; before: El[] }
  | { t: 'stroke'; pts: number[]; hl: boolean }
  | { t: 'erase'; hit: Set<string> }
  | { t: 'laser' }
type HandleHit = { t: 'resize'; h: Handle } | { t: 'edgeEnd'; which: 'a' | 'b' } | { t: 'bend' } | { t: 'conn'; id: string; side: Side }

interface Ui { marquee?: Rect; guides?: Guide[]; draft?: El | null; hover?: string | null; erase?: Set<string>; laser?: { x: number; y: number; t: number }[]; snapEnd?: Pt | null }
interface View { x: number; y: number; k: number }

const KEY = (m: Mode) => `devpocket.draw.${m}`
const MIN_K = 0.1, MAX_K = 6
const DEFAULT_SIZE: Partial<Record<ShapeKind, [number, number]>> = { rect: [140, 80], ellipse: [120, 80], diamond: [130, 90], triangle: [110, 96], hexagon: [130, 84], star: [100, 96], cloud: [150, 96], cylinder: [84, 108] }

function loadDoc(mode: Mode): Doc {
  try { const raw = localStorage.getItem(KEY(mode)); if (raw) return parseDoc(raw) } catch { /* ignore */ }
  return mode === 'whiteboard' ? { ...emptyDoc(), grid: false, snap: false } : emptyDoc()
}
const isTyping = (t: EventTarget | null) => { const e = t as HTMLElement | null; return !!e && (e.tagName === 'INPUT' || e.tagName === 'TEXTAREA' || e.tagName === 'SELECT' || e.isContentEditable) }
const R = (r: Rect) => ({ x: r.x, y: r.y, width: r.w, height: r.h })

export default function DrawEditor({ mode }: { mode: Mode }) {
  const wb = mode === 'whiteboard'
  const [doc, setDoc] = useState<Doc>(() => loadDoc(mode))
  const docRef = useRef(doc)
  const [sel, setSel] = useState<string[]>([]); const selRef = useRef<string[]>([])
  const [tool, setToolState] = useState<Tool>('select'); const toolRef = useRef<Tool>('select')
  const [view, setViewState] = useState<View>({ x: 80, y: 60, k: 1 }); const viewRef = useRef(view)
  const [size, setSize] = useState({ w: 800, h: 600 })
  const [ui, setUi] = useState<Ui>({})
  const [editing, setEditingState] = useState<{ id: string; value: string; all?: boolean } | null>(null)
  const editRef = useRef<{ id: string; value: string; all?: boolean } | null>(null)
  const setEditing = (v: { id: string; value: string; all?: boolean } | null) => { editRef.current = v; setEditingState(v) }
  const [modal, setModal] = useState<null | 'mermaid' | 'help' | 'png'>(null)
  const [notice, setNotice] = useState<{ kind: 'info' | 'error'; text: string } | null>(null)
  const [save, setSave] = useState<'saved' | 'saving' | 'off'>('saved')
  const [panels, setPanels] = useState(() => { try { return window.matchMedia('(min-width: 768px)').matches } catch { return true } })
  const [libOpen, setLibOpen] = useState(false)
  const [defaults, setDefaults] = useState<Defaults>(() => ({ s: { ...defaultStyle(), ...(wb ? { fill: 'none', sw: 3 } : {}) }, route: wb ? 'straight' : 'orth', head: 'triangle', tail: 'none' }))
  const defaultsRef = useRef(defaults); defaultsRef.current = defaults
  const hist = useRef<{ past: El[][]; future: El[][]; key: string; at: number }>({ past: [], future: [], key: '', at: 0 })
  const [, bump] = useState(0)
  const svgRef = useRef<SVGSVGElement>(null); const boxRef = useRef<HTMLDivElement>(null); const wrapRef = useRef<HTMLDivElement>(null)
  const openRef = useRef<HTMLInputElement>(null); const imgRef = useRef<HTMLInputElement>(null); const taRef = useRef<HTMLTextAreaElement>(null)
  const drag = useRef<Drag | null>(null); const pointers = useRef(new Map<number, Pt>()); const pinch = useRef<{ d: number; v: View; c: Pt } | null>(null)
  const space = useRef(false); const clip = useRef<El[]>([]); const laserRef = useRef<{ x: number; y: number; t: number }[]>([])
  const idp = useMemo(() => `d${uid().slice(-6)}`, [])
  toolRef.current = tool; docRef.current = doc; selRef.current = sel; viewRef.current = view
  const els = doc.els
  const nodes = useMemo(() => nodeMap(els), [els])
  const selEls = useMemo(() => { const s = new Set(sel); return els.filter((e) => s.has(e.id)) }, [els, sel])
  const dark = isDarkColor(doc.bg)

  // ---------- state helpers ----------
  const setTool = (t: Tool) => { toolRef.current = t; setToolState(t); setUi((u) => ({ ...u, draft: null })) }
  const setSelSync = (ids: string[]) => { selRef.current = ids; setSel(ids) }
  const setView = (v: View) => { viewRef.current = v; setViewState(v) }
  const elsNow = () => docRef.current.els
  const setEls = (next: El[]) => { docRef.current = { ...docRef.current, els: next }; setDoc(docRef.current) }
  const pushHist = (snap: El[], merge?: string) => {
    const h = hist.current; const now = Date.now()
    if (merge && h.key === merge && now - h.at < 900) { h.at = now; return }
    h.past.push(snap); if (h.past.length > 200) h.past.shift(); h.future = []; h.key = merge ?? ''; h.at = now; bump((n) => n + 1)
  }
  const apply = (fn: (e: El[]) => El[], o: { record?: boolean; merge?: string } = {}) => {
    const cur = elsNow(); const next = fn(cur); if (next === cur) return
    if (o.record !== false) pushHist(cur, o.merge)
    setEls(next)
  }
  const prune = (ids: string[]) => { const have = new Set(elsNow().map((e) => e.id)); const keep = ids.filter((i) => have.has(i)); if (keep.length !== ids.length) setSelSync(keep) }
  const undo = () => { const h = hist.current; const prev = h.past.pop(); if (!prev) return; h.future.push(elsNow()); h.key = ''; setEls(prev); prune(selRef.current); bump((n) => n + 1) }
  const redo = () => { const h = hist.current; const nxt = h.future.pop(); if (!nxt) return; h.past.push(elsNow()); h.key = ''; setEls(nxt); prune(selRef.current); bump((n) => n + 1) }
  const setPage = (p: Partial<Pick<Doc, 'bg' | 'grid' | 'gridSize' | 'snap'>>) => {
    docRef.current = { ...docRef.current, ...p }; setDoc(docRef.current)
  }
  const flash = (text: string, kind: 'info' | 'error' = 'info') => { setNotice({ kind, text }); window.clearTimeout((flash as unknown as { t?: number }).t); (flash as unknown as { t?: number }).t = window.setTimeout(() => setNotice(null), kind === 'error' ? 7000 : 3500) }

  // ---------- persistence ----------
  useEffect(() => {
    setSave('saving')
    const t = window.setTimeout(() => { try { localStorage.setItem(KEY(mode), serializeDoc(doc)); setSave('saved') } catch { setSave('off') } }, 700)
    return () => window.clearTimeout(t)
  }, [doc, mode])

  // ---------- viewport ----------
  useEffect(() => {
    const el = boxRef.current; if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight })); ro.observe(el); setSize({ w: el.clientWidth, h: el.clientHeight }); return () => ro.disconnect()
  }, [])
  const zoomAt = (f: number, cx: number, cy: number) => { const v = viewRef.current; const k = clamp(v.k * f, MIN_K, MAX_K); setView({ k, x: cx - ((cx - v.x) / v.k) * k, y: cy - ((cy - v.y) / v.k) * k }) }
  const fitRect = useCallback((r: Rect | null, maxK = 1.5) => {
    const el = boxRef.current; const w = el?.clientWidth ?? 800, h = el?.clientHeight ?? 600
    if (!r || (!r.w && !r.h)) { setView({ x: w / 2 - 0, y: h / 2 - 0, k: 1 }); return }
    const pad = 60; const k = clamp(Math.min((w - pad * 2) / Math.max(r.w, 1), (h - pad * 2) / Math.max(r.h, 1)), MIN_K, maxK)
    setView({ k, x: w / 2 - (r.x + r.w / 2) * k, y: h / 2 - (r.y + r.h / 2) * k })
  }, [])
  const fitAll = () => fitRect(boundsOf(elsNow()))
  useEffect(() => { if (elsNow().length) fitRect(boundsOf(elsNow())); else setView({ x: 120, y: 90, k: 1 }) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = boxRef.current; if (!el) return
    const wheel = (e: WheelEvent) => {
      e.preventDefault(); const r = el.getBoundingClientRect()
      if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top)
      else { const v = viewRef.current; setView({ ...v, x: v.x - (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX), y: v.y - (e.shiftKey && !e.deltaX ? 0 : e.deltaY) }) }
    }
    el.addEventListener('wheel', wheel, { passive: false }); return () => el.removeEventListener('wheel', wheel)
  }, [])
  const centerWorld = (): Pt => { const v = viewRef.current; return { x: (size.w / 2 - v.x) / v.k, y: (size.h / 2 - v.y) / v.k } }
  const world = (e: { clientX: number; clientY: number }): Pt => { const r = svgRef.current!.getBoundingClientRect(); const v = viewRef.current; return { x: (e.clientX - r.left - v.x) / v.k, y: (e.clientY - r.top - v.y) / v.k } }
  const gs = () => (docRef.current.snap && docRef.current.grid ? docRef.current.gridSize : 0)
  const sn = (n: number) => { const g = gs(); return g ? Math.round(n / g) * g : n }

  // ---------- hit testing ----------
  const hitTop = (p: Pt, only?: (e: El) => boolean): El | null => {
    const list = elsNow(); const nm = nodeMap(list); const tol = 5 / viewRef.current.k
    for (let i = list.length - 1; i >= 0; i--) { const e = list[i]; if (only && !only(e)) continue; if (hitEl(e, p, tol, nm)) return e }
    return null
  }
  const nodeAt = (p: Pt): Node | null => {
    const list = elsNow(); const pad = 4 / viewRef.current.k
    for (let i = list.length - 1; i >= 0; i--) { const e = list[i]; if (e.t === 'shape' && e.kind !== 'text' && inRect(p, padRect(nodeRect(e), pad))) return e; if (e.t === 'image' && inRect(p, nodeRect(e))) return e }
    return null
  }
  const connTarget = (): Node | null => {
    if (!['select', 'connector'].includes(toolRef.current) && !wb) return null
    if (toolRef.current !== 'select' && toolRef.current !== 'connector') return null
    const h = ui.hover ? nodes.get(ui.hover) : undefined; if (h && !h.lock) return h as Node
    if (selEls.length === 1 && isNode(selEls[0]) && !selEls[0].lock) return selEls[0]
    return null
  }
  const hitHandle = (p: Pt): HandleHit | null => {
    const k = viewRef.current.k; const r = 8 / k; const list = selRef.current.map((id) => elsNow().find((e) => e.id === id)).filter(Boolean) as El[]
    if (list.length === 1 && toolRef.current === 'select') {
      const e = list[0]
      if (isNode(e) && !e.lock) { for (const h of HANDLES) if (dist(p, handlePos(nodeRect(e), h)) <= r) return { t: 'resize', h } }
      if (e.t === 'edge') { const g = edgeGeo(e, nodeMap(elsNow())); if (dist(p, g.a) <= r + 2 / k) return { t: 'edgeEnd', which: 'a' }; if (dist(p, g.b) <= r + 2 / k) return { t: 'edgeEnd', which: 'b' }; if (g.bendHandle && dist(p, g.bendHandle.p) <= r) return { t: 'bend' } }
    }
    const tgt = connTarget()
    if (tgt) for (const side of SIDES) { const a = anchor(tgt, side), n = NORMAL[side]; if (dist(p, { x: a.x + (n.x * 24) / k, y: a.y + (n.y * 24) / k }) <= 11 / k) return { t: 'conn', id: tgt.id, side } }
    return null
  }
  /** Where an edge end lands when released at `p`. */
  const endAt = (p: Pt, avoid?: string): End => {
    const n = nodeAt(p); const k = viewRef.current.k
    if (n && n.id !== avoid) { const ns = nearestSide(n, p); return ns.d < 18 / k ? { id: n.id, side: ns.side } : { id: n.id } }
    return { x: sn(p.x), y: sn(p.y) }
  }

  // ---------- element operations ----------
  const addEls = (list: El[], select = true) => { apply((cur) => [...cur, ...list]); if (select) setSelSync(list.map((e) => e.id)) }
  const del = (ids: string[]) => { if (!ids.length) return; const all = new Set(expandGroups(elsNow(), ids)); apply((c) => removeEls(c, all.size ? all : ids)); setSelSync([]) }
  const duplicate = () => { const ids = selRef.current; if (!ids.length) return; const c = cloneEls(elsNow(), ids, 24, 24); addEls(c) }
  const copy = () => { const ids = selRef.current; if (!ids.length) return; clip.current = elsNow().filter((e) => ids.includes(e.id)); void copyText(JSON.stringify({ devpocket: 'els', els: clip.current })).catch?.(() => 0) }
  const paste = (list?: El[]) => {
    const src = list ?? clip.current; if (!src.length) return
    const ids = src.map((e) => e.id); const base = [...elsNow().filter((e) => !ids.includes(e.id)), ...src]
    const c = cloneEls(base, ids, 28, 28); addEls(c); clip.current = c.map((e) => ({ ...e }))
  }
  const insertEls = (list: El[], replace = false, select = true) => {
    const b = boundsOf(list); if (!b) return
    const c = centerWorld(); const empty = !elsNow().length
    const dx = Math.round(c.x - b.w / 2 - b.x), dy = Math.round(c.y - b.h / 2 - b.y)
    const moved = list.map((e) => moveEl(e, dx, dy))
    apply((cur) => (replace ? moved : [...cur, ...moved])); setSelSync(select ? moved.map((e) => e.id) : [])
    if (empty || replace) window.setTimeout(() => fitRect(boundsOf(moved)), 0)
  }
  const updateSel = (fn: (e: El) => El, merge?: string) => { const ids = new Set(selRef.current); if (!ids.size) return; apply((c) => c.map((e) => (ids.has(e.id) ? fn(e) : e)), { merge }) }
  const startEdit = (id: string) => { const e = elsNow().find((x) => x.id === id); if (!e || e.t === 'stroke' || e.t === 'image' || e.lock) return; setEditing({ id, value: e.text, all: true }) }
  const finishEdit = (commit = true) => {
    const ed = editing; if (!ed) return; setEditing(null)
    if (!commit) return
    const e = elsNow().find((x) => x.id === ed.id); if (!e || (e.t !== 'shape' && e.t !== 'edge')) return
    const text = ed.value.replace(/\s+$/, '')
    if (e.t === 'shape' && e.kind === 'text' && !text) { apply((c) => c.filter((x) => x.id !== e.id)); setSelSync([]); return }
    if (text === e.text) return
    apply((c) => c.map((x) => {
      if (x.id !== e.id || x.t !== 'shape') return x.id === e.id ? { ...x, text } : x
      if (x.kind === 'text') { const t = textSize(text, x.s); return { ...x, text, w: Math.max(24, Math.min(560, Math.ceil(t.w) + 12)), h: Math.max(lineHeight(x.s.fs) + 6, t.h + 8) } }
      const g = shapeGeom(x.kind, x.w, x.h); const lines = wrap(text, Math.max(10, g.text.w - 12), x.s); const need = lines.length * lineHeight(x.s.fs) + 14
      return { ...x, text, h: x.kind === 'note' || x.kind === 'rect' || x.kind === 'icon' ? Math.max(x.h, Math.ceil(need)) : x.h }
    }))
  }
  const cloneConnect = (id: string, side: Side) => {
    const n = elsNow().find((e): e is ShapeEl => e.id === id && e.t === 'shape'); if (!n) return
    const gap = 60; const nx = NORMAL[side]
    const nw = newShape(n.kind, n.x + nx.x * (n.w + gap), n.y + nx.y * (n.h + gap), n.w, n.h, { s: { ...n.s }, ic: n.ic, text: n.kind === 'icon' ? n.text : '' })
    const ed = newEdge({ id: n.id, side }, { id: nw.id, side: ({ t: 'b', b: 't', l: 'r', r: 'l' } as const)[side] }, { route: defaultsRef.current.route, head: defaultsRef.current.head, tail: defaultsRef.current.tail, s: { ...defaultsRef.current.s, fill: 'none' } })
    apply((c) => [...c, nw, ed]); setSelSync([nw.id]); startEdit(nw.id)
  }
  const arrange: PropsApi['arrange'] = (a) => {
    const ids = selRef.current; if (!ids.length) return
    if (a === 'delete') return del(ids)
    if (['front', 'back', 'forward', 'backward'].includes(a)) return apply((c) => reorder(c, ids, a as 'front'))
    if (a === 'group') return apply((c) => groupEls(c, ids))
    if (a === 'ungroup') return apply((c) => ungroupEls(c, ids))
    if (a === 'lock') { const all = elsNow().filter((e) => ids.includes(e.id)).every((e) => e.lock); return updateSel((e) => ({ ...e, lock: all ? undefined : true })) }
    const list = elsNow().filter((e) => ids.includes(e.id) && e.t !== 'edge'); const nm = nodeMap(elsNow()); const rs = list.map((e) => elRect(e, nm))
    const ds = a === 'dist-h' ? distributeDeltas(rs, 'h') : a === 'dist-v' ? distributeDeltas(rs, 'v') : alignDeltas(rs, a as AlignMode)
    const by = new Map(list.map((e, i) => [e.id, ds[i]])); apply((c) => c.map((e) => { const d = by.get(e.id); return d && (d.x || d.y) ? moveEl(e, d.x, d.y) : e }))
  }
  const propsApi: PropsApi = {
    style: (p) => { setDefaults((d) => ({ ...d, s: { ...d.s, ...p } })); updateSel((e) => ({ ...e, s: { ...e.s, ...p } }), `style:${Object.keys(p).join()}`) },
    edge: (p) => { setDefaults((d) => ({ ...d, ...p })); updateSel((e) => (e.t === 'edge' ? { ...e, ...p } : e)) },
    geom: (p) => updateSel((e) => (isNode(e) ? { ...e, ...p } : e), 'geom'),
    arrange, page: setPage,
  }

  // ---------- pointer interaction ----------
  const sizeFor = (kind: ShapeKind) => DEFAULT_SIZE[kind] ?? [130, 80]
  const styleFor = (kind: ShapeKind): Style => {
    const s = { ...defaultsRef.current.s }
    if (kind === 'text') return { ...s, fill: 'none', stroke: 'none' }
    if (kind === 'icon') return { ...s, fill: 'none' }
    return s
  }
  const buildEdge = (a: End, b: End, d: Drag & { t: 'edge' }): EdgeEl => {
    const df = defaultsRef.current
    return newEdge(a, b, { route: d.line || wb ? 'straight' : df.route, head: d.line ? 'none' : d.arrow || !wb ? df.head : 'none', tail: d.line ? 'none' : df.tail, s: { ...df.s, fill: 'none', radius: 0 } })
  }
  const strokeEl = (d: Drag & { t: 'stroke' }): El => {
    const s = { ...defaultsRef.current.s, fill: 'none' }
    if (d.hl) return { id: uid(), t: 'stroke', pts: d.pts, hl: true, s: { ...s, sw: Math.max(14, s.sw * 5), opacity: 0.4 } }
    return { id: uid(), t: 'stroke', pts: d.pts, s: { ...s, sw: s.sw * 1.6 + 0.6 } }
  }

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (editing) finishEdit(true)
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]; drag.current = null; setUi({})
      pinch.current = { d: dist(a, b), v: viewRef.current, c: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }; return
    }
    if (pointers.current.size > 2) return
    const p = world(e); const t = toolRef.current
    if (e.button === 1 || t === 'hand' || space.current) { drag.current = { t: 'pan', sx: e.clientX, sy: e.clientY, vx: viewRef.current.x, vy: viewRef.current.y }; return }
    if (e.button !== 0 && e.pointerType === 'mouse') return
    if (t === 'select' || t === 'connector') return selectDown(e, p)
    if (t === 'pen' || t === 'highlighter') { drag.current = { t: 'stroke', pts: [p.x, p.y, e.pointerType === 'pen' ? e.pressure : 0.5], hl: t === 'highlighter' }; setUi({ draft: strokeEl(drag.current) }); return }
    if (t === 'eraser') { drag.current = { t: 'erase', hit: new Set() }; eraseAt(p); return }
    if (t === 'laser') { drag.current = { t: 'laser' }; laserRef.current = [{ x: p.x, y: p.y, t: performance.now() }]; return }
    if (t === 'line' || t === 'arrow') { drag.current = { t: 'edge', a: endAt(p), start: p, line: t === 'line', arrow: t === 'arrow' }; return }
    if (t === 'text') { const n = newShape('text', sn(p.x), sn(p.y) - 12, 60, 30, { s: styleFor('text') }); addEls([n]); setTool('select'); window.setTimeout(() => startEdit(n.id), 30); return }
    if (t === 'sticky') {
      const i = elsNow().filter((x) => x.t === 'shape' && x.kind === 'note').length % STICKY.length
      const n = newShape('note', sn(p.x) - 80, sn(p.y) - 70, 160, 140, { s: { ...defaultStyle(), fill: STICKY[i], stroke: 'none', sw: 0, shadow: true, fs: 18, font: 'hand', color: '#1f2937' } }); addEls([n]); setTool('select'); window.setTimeout(() => startEdit(n.id), 30); return
    }
    if (t.startsWith('shape:')) drag.current = { t: 'create', kind: t.slice(6) as ShapeKind, start: p }
  }

  const selectDown = (e: React.PointerEvent, p: Pt) => {
    const h = hitHandle(p); const list = elsNow()
    if (h) {
      const ids = selRef.current
      if (h.t === 'resize') { const n = nodeMap(list).get(ids[0]) as Node; drag.current = { t: 'resize', h: h.h, orig: n, before: list }; return }
      if (h.t === 'edgeEnd') { drag.current = { t: 'edgeEnd', id: ids[0], which: h.which, before: list }; return }
      if (h.t === 'bend') { drag.current = { t: 'bend', id: ids[0], before: list }; return }
      if (h.t === 'conn') { drag.current = { t: 'edge', a: { id: h.id, side: h.side }, start: p, clone: { id: h.id, side: h.side }, line: false, arrow: true }; return }
    }
    const tool = toolRef.current
    if (tool === 'connector') { const n = nodeAt(p); if (n) { drag.current = { t: 'edge', a: endAt(p), start: p, line: false, arrow: true }; return } }
    const hit = hitTop(p)
    if (hit) {
      let ids = selRef.current
      if (e.shiftKey) { const set = new Set(ids); const grp = expandGroups(list, [hit.id]); if (set.has(hit.id)) grp.forEach((g) => set.delete(g)); else grp.forEach((g) => set.add(g)); setSelSync([...set]); return }
      if (!ids.includes(hit.id)) { ids = expandGroups(list, [hit.id]); setSelSync(ids) }
      const before = list; let cur = list
      if (e.altKey) { const c = cloneEls(list, ids, 0, 0); cur = [...list, ...c]; setEls(cur); ids = c.map((x) => x.id); setSelSync(ids) }
      const movable = new Set(ids.filter((id) => !cur.find((x) => x.id === id)?.lock))
      drag.current = { t: 'move', ids: movable, start: p, orig: cur, before, moved: false, hitId: hit.id }; return
    }
    if (!e.shiftKey) setSelSync([])
    drag.current = { t: 'marquee', start: p, base: e.shiftKey ? selRef.current : [] }
  }

  const eraseAt = (p: Pt) => {
    const d = drag.current; if (!d || d.t !== 'erase') return
    const h = hitTop(p, (x) => !x.lock); if (h && !d.hit.has(h.id)) { d.hit.add(h.id); setUi({ erase: new Set(d.hit) }) }
  }

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]; const pc = pinch.current; const k = clamp(pc.v.k * (dist(a, b) / pc.d), MIN_K, MAX_K); const r = boxRef.current!.getBoundingClientRect()
      const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; const wx = (pc.c.x - r.left - pc.v.x) / pc.v.k, wy = (pc.c.y - r.top - pc.v.y) / pc.v.k
      setView({ k, x: c.x - r.left - wx * k, y: c.y - r.top - wy * k }); return
    }
    const d = drag.current; const k = viewRef.current.k; const p = world(e)
    if (!d) {
      if (toolRef.current === 'select' || toolRef.current === 'connector') {
        const h = hitHandle(p); let hover = ui.hover ?? null
        if (!(h && h.t === 'conn')) { const hit = hitTop(p, (x) => isNode(x)); hover = hit ? hit.id : null }
        if (hover !== (ui.hover ?? null)) setUi((u) => ({ ...u, hover }))
        const c = svgRef.current; if (c) c.style.cursor = h ? (h.t === 'resize' ? `${h.h}-resize` : h.t === 'conn' ? 'crosshair' : 'move') : toolRef.current === 'connector' ? 'crosshair' : hover ? 'move' : 'default'
      }
      return
    }
    switch (d.t) {
      case 'pan': setView({ ...viewRef.current, x: d.vx + e.clientX - d.sx, y: d.vy + e.clientY - d.sy }); return
      case 'move': {
        let dx = p.x - d.start.x, dy = p.y - d.start.y
        if (!d.moved && Math.hypot(dx, dy) * k < 3) return
        d.moved = true
        if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0 }
        const nm = nodeMap(d.orig); const mv = d.orig.filter((x) => d.ids.has(x.id) && x.t !== 'edge')
        const mr = unionRect(mv.map((x) => elRect(x, nm)))
        let guides: Guide[] = []
        if (mr && docRef.current.snap && !e.altKey) {
          const others = d.orig.filter((x) => isNode(x) && !d.ids.has(x.id)).map((x) => nodeRect(x as Node))
          const s = snapRect({ ...mr, x: mr.x + dx, y: mr.y + dy }, others, 6 / k, gs()); dx += s.dx; dy += s.dy; guides = s.guides
        }
        apply(() => d.orig.map((x) => (d.ids.has(x.id) ? moveEl(x, dx, dy) : x)), { record: false }); setUi({ guides }); return
      }
      case 'resize': {
        const o = d.orig; const dx = p.x - (handlePos(nodeRect(o), d.h).x), dy = p.y - handlePos(nodeRect(o), d.h).y
        let r = resizeRect(nodeRect(o), d.h, dx, dy, e.shiftKey || o.t === 'image')
        if (gs() && !e.shiftKey && o.t !== 'image') { const g = gs(); const x2 = Math.round((r.x + r.w) / g) * g, y2 = Math.round((r.y + r.h) / g) * g; const x1 = Math.round(r.x / g) * g, y1 = Math.round(r.y / g) * g; r = resizeRect(nodeRect(o), d.h, 0, 0, false); r = { x: d.h.includes('w') ? x1 : r.x, y: d.h.includes('n') ? y1 : r.y, w: 0, h: 0 }; const base = nodeRect(o); const nx1 = d.h.includes('w') ? x1 : base.x, nx2 = d.h.includes('e') ? x2 : base.x + base.w, ny1 = d.h.includes('n') ? y1 : base.y, ny2 = d.h.includes('s') ? y2 : base.y + base.h; r = { x: Math.min(nx1, nx2), y: Math.min(ny1, ny2), w: Math.max(12, Math.abs(nx2 - nx1)), h: Math.max(12, Math.abs(ny2 - ny1)) } }
        apply((c) => c.map((x) => (x.id === o.id ? { ...x, ...r } : x)), { record: false }); return
      }
      case 'marquee': { const r = normRect(d.start, p); setUi({ marquee: r }); return }
      case 'create': { let r = normRect({ x: sn(d.start.x), y: sn(d.start.y) }, { x: sn(p.x), y: sn(p.y) }); if (e.shiftKey) { const m = Math.max(r.w, r.h); r = { ...r, w: m, h: m } } setUi({ draft: Math.hypot(r.w, r.h) * k < 5 ? null : newShape(d.kind, r.x, r.y, r.w, r.h, { id: 'draft', s: styleFor(d.kind) }) }); return }
      case 'edge': {
        if (dist(p, d.start) * k < 3) return
        const b = endAt(p, d.a.id); setUi({ draft: buildEdge(d.a, b, d) }); return
      }
      case 'edgeEnd': { const cur = elsNow().find((x) => x.id === d.id) as EdgeEl | undefined; if (!cur) return; const other = d.which === 'a' ? cur.b.id : cur.a.id; const end = endAt(p, other); apply((c) => c.map((x) => (x.id === d.id && x.t === 'edge' ? { ...x, [d.which]: end } : x)), { record: false }); return }
      case 'bend': {
        const cur = elsNow().find((x) => x.id === d.id) as EdgeEl | undefined; if (!cur) return; const g = edgeGeo(cur, nodeMap(elsNow())); if (!g.bendHandle) return
        const [A, B] = [g.a, g.b]; const t = g.bendHandle.axis === 'x' ? (p.x - A.x) / (B.x - A.x || 1) : (p.y - A.y) / (B.y - A.y || 1)
        apply((c) => c.map((x) => (x.id === d.id && x.t === 'edge' ? { ...x, bend: clamp(t, 0.08, 0.92) } : x)), { record: false }); return
      }
      case 'stroke': {
        const evs = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent]
        for (const ev of evs.length ? evs : [e.nativeEvent]) { const q = world(ev); const n = d.pts.length; if (Math.hypot(q.x - d.pts[n - 3], q.y - d.pts[n - 2]) * k >= 1.5) d.pts.push(q.x, q.y, ev.pointerType === 'pen' ? ev.pressure : 0.5) }
        setUi({ draft: strokeEl({ ...d, pts: d.pts.slice() }) }); return
      }
      case 'erase': eraseAt(p); return
      case 'laser': laserRef.current.push({ x: p.x, y: p.y, t: performance.now() }); setUi({ laser: laserRef.current.slice() }); return
    }
  }

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId)
    if (pinch.current) { if (pointers.current.size < 2) pinch.current = null; if (pointers.current.size === 0) drag.current = null; return }
    const d = drag.current; drag.current = null; const k = viewRef.current.k; const p = world(e)
    if (!d) return
    switch (d.t) {
      case 'move':
        if (d.moved) { if (elsNow() !== d.before) pushHist(d.before) }
        else { if (d.orig !== d.before) pushHist(d.before); if (!e.shiftKey && selRef.current.length > 1) setSelSync(expandGroups(elsNow(), [d.hitId])) }
        setUi({}); break
      case 'resize': case 'edgeEnd': case 'bend': if (elsNow() !== d.before) pushHist(d.before); break
      case 'marquee': {
        const r = normRect(d.start, p); setUi({})
        if (r.w * k < 3 && r.h * k < 3) break
        const nm = nodeMap(elsNow()); const hit = elsNow().filter((x) => rectsHit(r, elRect(x, nm))).map((x) => x.id)
        setSelSync(expandGroups(elsNow(), [...new Set([...d.base, ...hit])])); break
      }
      case 'create': {
        const tiny = dist(p, d.start) * k < 6; const [dw, dh] = sizeFor(d.kind)
        const r = tiny ? { x: sn(d.start.x - dw / 2), y: sn(d.start.y - dh / 2), w: dw, h: dh } : (() => { let q = normRect({ x: sn(d.start.x), y: sn(d.start.y) }, { x: sn(p.x), y: sn(p.y) }); if (e.shiftKey) { const m = Math.max(q.w, q.h); q = { ...q, w: m, h: m } } return { ...q, w: Math.max(12, q.w), h: Math.max(12, q.h) } })()
        const n = newShape(d.kind, r.x, r.y, r.w, r.h, { s: styleFor(d.kind) }); addEls([n]); setUi({}); setTool('select'); break
      }
      case 'edge': {
        setUi({})
        if (dist(p, d.start) * k < 4) { if (d.clone) cloneConnect(d.clone.id, d.clone.side); break }
        const b = endAt(p, d.a.id); const ed = buildEdge(d.a, b, d)
        addEls([ed]); if (toolRef.current !== 'connector') setTool('select'); break
      }
      case 'stroke': {
        setUi({}); const st = strokeEl(d); const dot = d.pts.length < 4 * 3; if (dot && d.pts.length < 6) d.pts.push(d.pts[0] + 0.01, d.pts[1], 0.5)
        addEls([{ ...st, pts: d.pts } as El], false); break
      }
      case 'erase': { setUi({}); if (d.hit.size) { apply((c) => removeEls(c, d.hit)); prune(selRef.current) } break }
      case 'laser': break
      default: setUi({})
    }
  }
  const onDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (toolRef.current !== 'select') return
    const p = world(e); const hit = hitTop(p)
    if (hit && (hit.t === 'shape' || hit.t === 'edge')) { setSelSync([hit.id]); startEdit(hit.id); return }
    if (!hit) { const n = newShape('text', sn(p.x), sn(p.y) - 12, 60, 30, { s: styleFor('text') }); addEls([n]); startEdit(n.id) }
  }
  // laser fades
  useEffect(() => {
    if (!ui.laser?.length) return
    const id = window.setInterval(() => { const now = performance.now(); laserRef.current = laserRef.current.filter((q) => now - q.t < 900); setUi((u) => ({ ...u, laser: laserRef.current.slice() })) }, 50)
    return () => window.clearInterval(id)
  }, [ui.laser?.length])

  // ---------- files ----------
  const place = (src: string, w: number, h: number, at?: Pt) => {
    const k = Math.min(1, 520 / Math.max(w, 1), 420 / Math.max(h, 1)); const c = at ?? centerWorld()
    const im: El = { id: uid(), t: 'image', x: Math.round(c.x - (w * k) / 2), y: Math.round(c.y - (h * k) / 2), w: Math.round(w * k), h: Math.round(h * k), src, s: defaultStyle() }
    addEls([im])
  }
  const addImageFile = async (f: File, at?: Pt) => {
    if (!/^image\//.test(f.type)) return flash('That file is not an image.', 'error')
    const url = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = () => rej(r.error); r.readAsDataURL(f) })
    const img = new Image(); await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('bad image')); img.src = url }).catch(() => null)
    if (!img.width) return flash('Could not read that image.', 'error')
    let src = url; const max = 1600
    if (f.type !== 'image/svg+xml' && Math.max(img.width, img.height) > max) { const s = max / Math.max(img.width, img.height); const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height); src = c.toDataURL(f.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.88) }
    place(src, img.width, img.height, at)
  }
  const stem = () => (wb ? 'whiteboard' : 'diagram')
  const newDoc = () => { if (elsNow().length && !window.confirm('Start a new drawing? The current one will be cleared (undo can bring it back).')) return; apply(() => []); setSelSync([]); setView({ x: 120, y: 90, k: 1 }) }
  const openFile = async (f: File) => {
    try {
      const text = await f.text()
      if (/\.(drawio|xml)$/i.test(f.name) || text.trimStart().startsWith('<')) { const r = await fromDrawio(text); apply(() => r.doc.els); setPage({ bg: r.doc.bg }); setSelSync([]); window.setTimeout(() => fitRect(boundsOf(r.doc.els)), 0); flash(`Imported ${r.doc.els.length} elements from draw.io${r.notes.length ? ` (${r.notes[0]})` : ''}.`) }
      else { const d = parseDoc(text); apply(() => d.els); setPage({ bg: d.bg, grid: d.grid, gridSize: d.gridSize, snap: d.snap }); setSelSync([]); window.setTimeout(() => fitRect(boundsOf(d.els)), 0); flash(`Opened ${f.name}.`) }
    } catch (er) { flash((er as Error).message || 'Could not open that file.', 'error') }
  }
  const exportSel = () => { const ids = selRef.current; return ids.length ? elsNow().filter((e) => ids.includes(e.id)) : elsNow() }
  const svgOut = (transparent = false) => sceneToSvg(exportSel(), doc.bg, { transparent })
  const pngOut = async (scale: number, transparent: boolean) => { const { svg } = await svgOut(transparent); return (await svgToPng(svg, scale, transparent ? 'transparent' : doc.bg)).blob }
  const exportPng = async (scale = 2, transparent = false) => { if (!elsNow().length) return flash('Nothing to export yet.', 'error'); try { downloadBlob(`${stem()}.png`, await pngOut(scale, transparent)); flash(`PNG exported at ${scale}×.`) } catch (er) { flash((er as Error).message, 'error') } }
  const copyPng = async () => { if (!elsNow().length) return; try { const blob = await pngOut(2, false); await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); flash('Copied as PNG.') } catch { flash('Your browser blocked image copy; use Download PNG.', 'error') } }

  // ---------- keyboard + paste ----------
  useEffect(() => {
    const WB: Record<string, Tool> = { v: 'select', h: 'hand', p: 'pen', u: 'highlighter', e: 'eraser', l: 'line', a: 'arrow', t: 'text', n: 'sticky', k: 'laser', r: 'shape:rect', o: 'shape:ellipse', d: 'shape:diamond' }
    const down = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return
      const mod = e.metaKey || e.ctrlKey; const k = e.key.toLowerCase(); const ids = selRef.current
      if (editRef.current) { if (e.key.length === 1 && !mod && !e.altKey) { e.preventDefault(); setEditing({ ...editRef.current, value: editRef.current.value + e.key, all: false }) } else if (e.key === 'Backspace') { e.preventDefault(); setEditing({ ...editRef.current, value: editRef.current.value.slice(0, -1), all: false }) } return }
      if (e.code === 'Space' && !mod) { space.current = true; if (svgRef.current) svgRef.current.style.cursor = 'grab'; e.preventDefault(); return }
      if (mod) {
        if (k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo() } else if (k === 'y') { e.preventDefault(); redo() }
        else if (k === 'c') { if (ids.length) { e.preventDefault(); copy() } } else if (k === 'x') { if (ids.length) { e.preventDefault(); copy(); del(ids) } }
        else if (k === 'd') { e.preventDefault(); duplicate() } else if (k === 'a') { e.preventDefault(); setSelSync(elsNow().map((x) => x.id)) }
        else if (k === 'g') { e.preventDefault(); arrange(e.shiftKey ? 'ungroup' : 'group') } else if (k === 's') { e.preventDefault(); downloadText(`${stem()}.dpdraw.json`, serializeDoc(docRef.current), 'application/json') }
        else if (k === '=' || k === '+') { e.preventDefault(); zoomAt(1.25, size.w / 2, size.h / 2) } else if (k === '-') { e.preventDefault(); zoomAt(1 / 1.25, size.w / 2, size.h / 2) } else if (k === '0') { e.preventDefault(); setView({ ...viewRef.current, k: 1 }) }
        else if (k === ']') { e.preventDefault(); arrange(e.shiftKey ? 'front' : 'forward') } else if (k === '[') { e.preventDefault(); arrange(e.shiftKey ? 'back' : 'backward') }
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') { if (ids.length) { e.preventDefault(); del(ids) } return }
      if (e.key === 'Escape') { setSelSync([]); setTool('select'); setUi({}); return }
      if (e.key === 'Enter' || e.key === 'F2') { if (ids.length === 1) { e.preventDefault(); startEdit(ids[0]) } return }
      if (e.key.startsWith('Arrow') && ids.length) {
        e.preventDefault(); const step = e.shiftKey ? gs() || 10 : 1; const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0, dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        const s = new Set(ids); apply((c) => c.map((x) => (s.has(x.id) && !x.lock ? moveEl(x, dx, dy) : x)), { merge: 'nudge' }); return
      }
      if (e.key === '?') { setModal('help'); return }
      if (e.shiftKey && e.key === '!') { fitAll(); return }
      if (e.shiftKey && e.key === '@') { const r = boundsOf(elsNow().filter((x) => ids.includes(x.id))); if (r) fitRect(r); return }
      if (wb && WB[k] && !e.shiftKey) { setTool(WB[k]); return }
      if (!wb && ids.length === 1 && e.key.length === 1 && !e.altKey) { const t = elsNow().find((x) => x.id === ids[0]); if (t && (t.t === 'shape' || t.t === 'edge') && !t.lock) { setEditing({ id: t.id, value: t.text + e.key }); e.preventDefault() } }
    }
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') { space.current = false; if (svgRef.current) svgRef.current.style.cursor = '' } }
    const onPaste = async (e: ClipboardEvent) => {
      if (isTyping(e.target)) return
      const items = [...(e.clipboardData?.items ?? [])]; const img = items.find((i) => i.type.startsWith('image/'))
      if (img) { e.preventDefault(); const f = img.getAsFile(); if (f) await addImageFile(f); return }
      const txt = e.clipboardData?.getData('text/plain') ?? ''
      if (!txt) return
      e.preventDefault()
      try { const j = JSON.parse(txt) as { devpocket?: string; els?: unknown }; if (j.devpocket === 'els' && Array.isArray(j.els)) { paste(parseDoc(JSON.stringify({ els: j.els })).els); return } } catch { /* not ours */ }
      if (/^\s*(flowchart|graph)\s/i.test(txt)) { try { insertEls(graphToEls(parseMermaidFlowchart(txt))); flash('Mermaid flowchart pasted as editable shapes.'); return } catch { /* fall through */ } }
      const c = centerWorld(); const t = textSize(txt.slice(0, 2000), defaultsRef.current.s)
      addEls([newShape('text', Math.round(c.x - t.w / 2), Math.round(c.y - t.h / 2), Math.ceil(t.w) + 12, t.h + 8, { text: txt.slice(0, 2000), s: styleFor('text') })])
    }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('paste', onPaste)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('paste', onPaste) }
  })

  // ---------- library drag/drop ----------
  const dropItem = (it: LibItem, at?: Pt) => { const c = at ?? centerWorld(); const n = libToShape(it, sn(c.x - it.w / 2), sn(c.y - it.h / 2), defaultsRef.current.s); addEls([n]); setTool('select') }
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); const raw = e.dataTransfer.getData('application/x-devpocket-lib'); const p = world(e)
    if (raw) { try { dropItem(JSON.parse(raw) as LibItem, p) } catch { /* ignore */ } return }
    const f = e.dataTransfer.files?.[0]; if (f) void (/\.(json|drawio|xml)$/i.test(f.name) ? openFile(f) : addImageFile(f, p))
  }

  // ---------- render helpers ----------
  const k = view.k; const sw1 = 1.5 / k
  const ctx = useMemo(() => ({ uid: idp, bg: doc.bg, dark }), [idp, doc.bg, dark])
  const hiddenIds = useMemo(() => new Set<string>([...(ui.erase ?? [])]), [ui.erase])
  const selSet = useMemo(() => new Set(sel), [sel])
  const single = selEls.length === 1 ? selEls[0] : null
  const hoverEl = ui.hover ? nodes.get(ui.hover) : undefined
  const tgt = !drag.current || drag.current.t === 'edge' ? connTarget() : null
  const gridOn = doc.grid && k > 0.35
  const gridColor = dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.09)'
  const world0 = { x: -view.x / k, y: -view.y / k, w: size.w / k, h: size.h / k }
  const editBox = (() => {
    if (!editing) return null
    const e = els.find((x) => x.id === editing.id); if (!e) return null
    let r: Rect; let align: Style['align'] = 'center'; let s: Style = e.s
    if (e.t === 'edge') { const g = edgeGeo(e, nodes); r = { x: g.mid.x - 90, y: g.mid.y - 14, w: 180, h: 28 } }
    else if (e.t === 'shape') { const g = shapeGeom(e.kind, e.w, e.h); r = e.kind === 'class' ? { x: e.x, y: e.y, w: e.w, h: e.h } : { x: e.x + g.text.x, y: e.y + g.text.y, w: Math.max(40, g.text.w), h: Math.max(24, g.text.h) }; if (e.kind === 'text') r = { x: e.x, y: e.y, w: Math.max(e.w, 120), h: Math.max(e.h, 30) }; align = e.kind === 'class' ? 'left' : e.s.align; s = e.s } else return null
    return { r, align, s }
  })()

  const toolBtn = (t: Tool, label: string, icon: React.ReactNode, hint?: string) => <IconBtn key={t} label={hint ? `${label} (${hint})` : label} on={tool === t} onClick={() => setTool(t)}>{icon}</IconBtn>
  const fileMenu = (
    <>
      <Menu label="File" icon={<FolderOpen size={14} />} testid="file-menu">
        {(close) => (<>
          <MenuItem onClick={() => { close(); newDoc() }}><span className="flex items-center gap-2"><FilePlus2 size={14} />New</span></MenuItem>
          <MenuItem onClick={() => { close(); openRef.current?.click() }}><span className="flex items-center gap-2"><FolderOpen size={14} />Open… (JSON or .drawio)</span></MenuItem>
          <MenuSep />
          <MenuItem hint="⌘S" onClick={() => { close(); downloadText(`${stem()}.dpdraw.json`, serializeDoc(docRef.current), 'application/json'); flash('Saved a DevPocket drawing file.') }}><span className="flex items-center gap-2"><Save size={14} />Save as JSON</span></MenuItem>
          <MenuItem onClick={() => { close(); const r = toDrawio(docRef.current, stem()); downloadText(`${stem()}.drawio`, r.xml, 'application/xml'); flash(r.skipped ? `Exported .drawio (${r.skipped} freehand stroke${r.skipped > 1 ? 's' : ''} skipped — draw.io has no ink).` : 'Exported .drawio — opens in diagrams.net.') }}><span className="flex items-center gap-2"><Share2 size={14} />Export to draw.io (.drawio)</span></MenuItem>
        </>)}
      </Menu>
      <Menu label="Export" icon={<Download size={14} />} testid="export-menu">
        {(close) => (<>
          <MenuItem onClick={() => { close(); void exportPng(2) }}><span className="flex items-center gap-2"><ImageIcon size={14} />PNG (2×)</span></MenuItem>
          <MenuItem onClick={() => { close(); void exportPng(4) }}><span className="flex items-center gap-2"><ImageIcon size={14} />PNG (4×, print quality)</span></MenuItem>
          <MenuItem onClick={() => { close(); void exportPng(2, true) }}><span className="flex items-center gap-2"><ImageIcon size={14} />PNG (transparent)</span></MenuItem>
          <MenuItem onClick={() => { close(); if (!elsNow().length) return flash('Nothing to export yet.', 'error'); void svgOut().then((r) => { downloadText(`${stem()}.svg`, r.svg, 'image/svg+xml'); flash('SVG exported (vector, fully editable).') }) }}><span className="flex items-center gap-2"><Download size={14} />SVG (vector)</span></MenuItem>
          <MenuItem onClick={() => { close(); if (!elsNow().length) return flash('Nothing to export yet.', 'error'); void svgOut().then((r) => { printSvg(r.svg, stem()); flash('Choose “Save as PDF” in the print dialog.') }) }}><span className="flex items-center gap-2"><Printer size={14} />PDF (print dialog)</span></MenuItem>
          <MenuSep />
          <MenuItem onClick={() => { close(); void copyPng() }}><span className="flex items-center gap-2"><Copy size={14} />Copy as PNG</span></MenuItem>
          <MenuItem onClick={() => { close(); void svgOut().then((r) => copyText(r.svg)).then(() => flash('SVG copied.')) }}><span className="flex items-center gap-2"><Copy size={14} />Copy as SVG</span></MenuItem>
        </>)}
      </Menu>
    </>
  )
  const undoRedo = <><IconBtn label="Undo (⌘Z)" onClick={undo} disabled={!hist.current.past.length}><Undo2 size={15} /></IconBtn><IconBtn label="Redo (⇧⌘Z)" onClick={redo} disabled={!hist.current.future.length}><Redo2 size={15} /></IconBtn></>
  const zoomCtl = (
    <div className="flex items-center gap-1" data-testid="zoom-controls">
      <IconBtn label="Zoom out" onClick={() => zoomAt(1 / 1.25, size.w / 2, size.h / 2)}><Minus size={14} /></IconBtn>
      <button type="button" className={cn(btn, 'w-14 px-0 tabular-nums')} title="Reset zoom to 100%" onClick={() => setView({ ...viewRef.current, k: 1 })} data-testid="zoom-level">{Math.round(k * 100)}%</button>
      <IconBtn label="Zoom in" onClick={() => zoomAt(1.25, size.w / 2, size.h / 2)}><Plus size={14} /></IconBtn>
      <IconBtn label="Fit to screen" onClick={fitAll}><Scan size={14} /></IconBtn>
    </div>
  )

  // ---------- canvas ----------
  const canvas = (
    <div ref={boxRef} className="relative h-full w-full touch-none overflow-hidden" style={{ background: doc.bg }} onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <svg ref={svgRef} data-testid="draw-canvas" className="absolute inset-0 h-full w-full select-none" style={{ cursor: tool === 'hand' ? 'grab' : tool === 'select' ? 'default' : tool === 'text' ? 'text' : tool === 'eraser' ? 'cell' : 'crosshair', touchAction: 'none' }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onDoubleClick={onDoubleClick} onContextMenu={(e) => e.preventDefault()}>
        <defs>
          <pattern id={`${idp}-g`} width={doc.gridSize} height={doc.gridSize} patternUnits="userSpaceOnUse">{wb ? <circle cx={doc.gridSize / 2} cy={doc.gridSize / 2} r={1} fill={gridColor} /> : <path d={`M${doc.gridSize} 0 H0 V${doc.gridSize}`} fill="none" stroke={gridColor} strokeWidth={1} />}</pattern>
        </defs>
        <g transform={`translate(${view.x} ${view.y}) scale(${k})`}>
          <SceneDefs uid={idp} />
          {gridOn && <rect data-testid="grid" x={world0.x} y={world0.y} width={world0.w} height={world0.h} fill={`url(#${idp}-g)`} pointerEvents="none" />}
          <g data-testid="scene"><SceneView els={els} nodes={nodes} ctx={ctx} skip={hiddenIds} /></g>
          {/* ----- overlay ----- */}
          <g pointerEvents="none">
            {ui.draft && <g opacity={0.85}><SceneView els={[ui.draft]} nodes={nodes} ctx={ctx} /></g>}
            {[...(ui.erase ?? [])].map((id) => { const e = els.find((x) => x.id === id); if (!e) return null; const r = elRect(e, nodes); return <rect key={id} {...R(r)} fill="rgba(239,68,68,0.15)" stroke="#ef4444" strokeWidth={sw1} strokeDasharray={`${4 / k} ${3 / k}`} /> })}
            {hoverEl && !selSet.has(hoverEl.id) && <rect x={hoverEl.x - 2 / k} y={hoverEl.y - 2 / k} width={hoverEl.w + 4 / k} height={hoverEl.h + 4 / k} fill="none" stroke="#60a5fa" strokeWidth={sw1} rx={3 / k} />}
            {selEls.map((e) => {
              if (e.t === 'edge') { const g = edgeGeo(e, nodes); return <path key={e.id} d={g.d} fill="none" stroke="#3b82f6" strokeOpacity={0.35} strokeWidth={e.s.sw + 6 / k} strokeLinecap="round" /> }
              const r = padRect(elRect(e, nodes), 3 / k); return <rect key={e.id} {...R(r)} fill="none" stroke="#3b82f6" strokeWidth={sw1} strokeDasharray={selEls.length > 1 || e.lock ? `${5 / k} ${3 / k}` : undefined} />
            })}
            {selEls.length > 1 && (() => { const u = unionRect(selEls.map((e) => elRect(e, nodes))); return u ? <rect {...R(padRect(u, 6 / k))} fill="none" stroke="#3b82f6" strokeWidth={sw1} strokeDasharray={`${6 / k} ${4 / k}`} /> : null })()}
            {single && isNode(single) && !single.lock && tool === 'select' && HANDLES.map((h) => { const q = handlePos(nodeRect(single), h); const s = 8 / k; return <rect key={h} x={q.x - s / 2} y={q.y - s / 2} width={s} height={s} rx={2 / k} fill="#fff" stroke="#3b82f6" strokeWidth={sw1} data-handle={h} /> })}
            {single && single.t === 'edge' && (() => { const g = edgeGeo(single, nodes); const r = 5 / k; return <>{[g.a, g.b].map((q, i) => <circle key={i} cx={q.x} cy={q.y} r={r} fill="#fff" stroke="#3b82f6" strokeWidth={sw1} data-handle={i ? 'end' : 'start'} />)}{g.bendHandle && <rect x={g.bendHandle.p.x - r} y={g.bendHandle.p.y - r} width={r * 2} height={r * 2} rx={2 / k} fill="#3b82f6" data-handle="bend" />}</> })()}
            {tgt && !editing && SIDES.map((side) => { const a = anchor(tgt, side), n = NORMAL[side]; const c = { x: a.x + (n.x * 24) / k, y: a.y + (n.y * 24) / k }; const r = 9 / k; const ang = Math.atan2(n.y, n.x) * (180 / Math.PI)
              return <g key={side} transform={`translate(${c.x} ${c.y})`} data-conn={side}><circle r={r} fill="#3b82f6" opacity={0.92} /><path transform={`rotate(${ang}) scale(${1 / k})`} d="M-3 -4 L3 0 L-3 4" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></g> })}
            {tgt && !editing && SIDES.map((side) => { const a = anchor(tgt, side); return <circle key={`p${side}`} cx={a.x} cy={a.y} r={3.5 / k} fill="#fff" stroke="#3b82f6" strokeWidth={sw1} /> })}
            {ui.draft && ui.draft.t === 'edge' && (() => { const e = ui.draft as EdgeEl; const b = e.b.id ? nodes.get(e.b.id) : null; return b ? <rect {...R(padRect(nodeRect(b), 3 / k))} fill="rgba(59,130,246,0.08)" stroke="#3b82f6" strokeWidth={sw1} /> : null })()}
            {ui.marquee && <rect {...R(ui.marquee)} fill="rgba(59,130,246,0.08)" stroke="#3b82f6" strokeWidth={sw1} strokeDasharray={`${4 / k} ${3 / k}`} />}
            {ui.guides?.map((g, i) => <line key={i} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke="#ec4899" strokeWidth={sw1} />)}
            {ui.laser && ui.laser.length > 1 && ui.laser.slice(1).map((q, i) => { const a = ui.laser![i]; const age = clamp(1 - (performance.now() - q.t) / 900, 0, 1); return <line key={i} x1={a.x} y1={a.y} x2={q.x} y2={q.y} stroke="#ef4444" strokeWidth={(3 + 4 * age) / k} strokeLinecap="round" opacity={age} /> })}
          </g>
        </g>
      </svg>
      {editing && editBox && (
        <textarea ref={taRef} aria-label="Edit text" data-testid="text-editor" value={editing.value} autoFocus spellCheck={false}
          onFocus={(e) => { const t = e.currentTarget; if (editing.all) t.select(); else t.setSelectionRange(t.value.length, t.value.length) }}
          onChange={(e) => setEditing({ ...editing, value: e.target.value, all: false })} onBlur={() => finishEdit(true)}
          onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); finishEdit(true) } else if ((e.key === 'Enter' && (e.metaKey || e.ctrlKey)) || (e.key === 'Enter' && els.find((x) => x.id === editing.id)?.t === 'edge')) { e.preventDefault(); finishEdit(true) } }}
          className="absolute resize-none overflow-hidden rounded-sm border border-dashed border-blue-500 bg-white/80 p-0 outline-none"
          style={{ left: editBox.r.x * k + view.x, top: editBox.r.y * k + view.y, width: editBox.r.w * k, height: editBox.r.h * k, fontFamily: FONTS[editBox.s.font], fontSize: editBox.s.fs * k, lineHeight: `${lineHeight(editBox.s.fs) * k}px`, textAlign: editBox.align, color: editBox.s.color === 'none' ? '#111' : editBox.s.color, fontWeight: editBox.s.bold ? 700 : 400, fontStyle: editBox.s.italic ? 'italic' : 'normal', paddingTop: Math.max(0, (editBox.r.h * k - (editing.value.split('\n').length * lineHeight(editBox.s.fs) * k)) / 2) }} />
      )}
      {!els.length && !editing && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center" data-testid="empty-hint">
          <div className="max-w-sm rounded-xl border bg-card/90 px-5 py-4 text-sm text-muted-foreground shadow-sm" style={{ color: dark ? '#cbd5e1' : undefined, background: dark ? 'rgba(15,23,42,0.7)' : undefined }}>
            {wb ? <><b className="text-foreground" style={{ color: dark ? '#fff' : undefined }}>Your infinite whiteboard.</b><br />Pick the pen and draw, drop in sticky notes and shapes, paste images. Scroll to pan, Ctrl/⌘ + scroll to zoom.</> : <><b className="text-foreground" style={{ color: dark ? '#fff' : undefined }}>Start your diagram.</b><br />Drag a shape from the library, or open Templates and try “Insert from Mermaid”. Hover a shape and drag an arrow to connect.</>}
          </div>
        </div>
      )}
      <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-lg border bg-card/95 p-1 shadow-sm backdrop-blur">{zoomCtl}</div>
      {notice && <div role="status" className={cn('absolute bottom-2 left-1/2 max-w-[80%] -translate-x-1/2 rounded-lg border px-3 py-1.5 text-[13px] shadow-md', notice.kind === 'error' ? 'border-destructive/40 bg-card text-destructive' : 'bg-card text-foreground')} data-testid="draw-notice">{notice.text}</div>}
    </div>
  )

  const hiddenInputs = (
    <>
      <input ref={openRef} type="file" accept=".json,.drawio,.xml,application/json" className="hidden" data-testid="open-input" onChange={(e) => { const f = e.target.files?.[0]; if (f) void openFile(f); e.target.value = '' }} />
      <input ref={imgRef} type="file" accept="image/*" className="hidden" data-testid="image-input" onChange={(e) => { const f = e.target.files?.[0]; if (f) void addImageFile(f); e.target.value = '' }} />
    </>
  )
  const fs = useFullscreen()
  const fsBtn = <IconBtn label={fs.on ? 'Exit full screen' : 'Full screen'} on={fs.on} onClick={() => void fs.toggle()}>{fs.on ? <Minimize2 size={14} /> : <Maximize2 size={14} />}</IconBtn>
  const status = <span className="text-[11px] text-muted-foreground" title="Your drawing is autosaved in this browser only. It is never uploaded.">{save === 'off' ? 'Autosave off (drawing too large)' : save === 'saving' ? 'Saving…' : 'Saved in this browser'}</span>
  const pageApi = { bg: doc.bg, grid: doc.grid, gridSize: doc.gridSize, snap: doc.snap }
  const props = <PropsPanel sel={selEls} defaults={defaults} api={propsApi} page={pageApi} showPage mode={mode} />

  const mermaidModal = modal === 'mermaid' && <MermaidModal onClose={() => setModal(null)} onInsert={(list, replace) => { insertEls(list, replace, false); setModal(null) }} />
  const helpModal = modal === 'help' && <HelpModal wb={wb} onClose={() => setModal(null)} />

  if (wb) {
    const shapesMenu = (
      <Menu label="" icon={<Square size={15} />} testid="shape-menu" up>
        {(close) => (<>{([['rect', 'Rectangle', 'R'], ['ellipse', 'Ellipse', 'O'], ['diamond', 'Diamond', 'D'], ['triangle', 'Triangle', ''], ['hexagon', 'Hexagon', ''], ['star', 'Star', ''], ['cloud', 'Cloud', ''], ['cylinder', 'Cylinder', '']] as [ShapeKind, string, string][]).map(([kd, l, h]) => <MenuItem key={kd} hint={h} onClick={() => { close(); setTool(`shape:${kd}`) }}>{l}</MenuItem>)}</>)}
      </Menu>
    )
    return (
      <div ref={wrapRef} className="relative h-[calc(100vh-190px)] min-h-[520px] overflow-hidden rounded-xl border bg-card" data-testid="whiteboard">
        {hiddenInputs}
        <div className="absolute inset-0">{canvas}</div>
        <div className="absolute left-2 top-2 z-30 flex max-w-[calc(100%-150px)] flex-wrap items-center gap-1.5 rounded-lg border bg-card/95 p-1 shadow-sm backdrop-blur">{fileMenu}<IconBtn label="Keyboard shortcuts (?)" onClick={() => setModal('help')} className="hidden sm:inline-flex"><Keyboard size={14} /></IconBtn><div className="hidden px-1.5 sm:block">{status}</div></div>
        <div className="absolute right-2 top-2 z-30 flex items-center gap-1.5 rounded-lg border bg-card/95 p-1 shadow-sm backdrop-blur">{undoRedo}<IconBtn label="Present full screen" onClick={() => { const el = wrapRef.current; if (!el) return; if (document.fullscreenElement) void document.exitFullscreen(); else void el.requestFullscreen?.() }}><Presentation size={14} /></IconBtn><IconBtn label={panels ? 'Hide style panel' : 'Show style panel'} on={panels} onClick={() => setPanels(!panels)}><PanelLeft size={14} /></IconBtn></div>
        {panels && <div className="absolute left-2 top-14 z-20 max-h-[calc(100%-150px)] w-[min(16rem,calc(100%-1rem))] overflow-y-auto rounded-xl border bg-card/95 shadow-md backdrop-blur scroll-thin">{props}</div>}
        <div className="absolute bottom-3 left-1/2 z-30 flex max-w-[96%] -translate-x-1/2 flex-wrap items-center justify-center gap-1 rounded-2xl border bg-card/95 p-1.5 shadow-lg backdrop-blur" role="toolbar" aria-label="Whiteboard tools" data-testid="wb-toolbar">
          {toolBtn('select', 'Select', <MousePointer2 size={15} />, 'V')}{toolBtn('hand', 'Pan', <Hand size={15} />, 'H')}
          <span className="mx-0.5 h-5 w-px bg-border" />
          {toolBtn('pen', 'Pen', <Pen size={15} />, 'P')}{toolBtn('highlighter', 'Highlighter', <Highlighter size={15} />, 'U')}{toolBtn('eraser', 'Eraser', <Eraser size={15} />, 'E')}
          <span className="mx-0.5 h-5 w-px bg-border" />
          {toolBtn('shape:rect', 'Rectangle', <Square size={15} />, 'R')}{toolBtn('shape:ellipse', 'Ellipse', <Circle size={15} />, 'O')}{toolBtn('shape:diamond', 'Diamond', <Diamond size={15} />, 'D')}{toolBtn('shape:triangle', 'Triangle', <Triangle size={15} />)}{shapesMenu}
          {toolBtn('line', 'Line', <Minus size={15} />, 'L')}{toolBtn('arrow', 'Arrow', <ArrowUpRight size={15} />, 'A')}{toolBtn('connector', 'Connector', <Spline size={15} />)}
          <span className="mx-0.5 h-5 w-px bg-border" />
          {toolBtn('text', 'Text', <Type size={15} />, 'T')}{toolBtn('sticky', 'Sticky note', <StickyNote size={15} />, 'N')}
          <IconBtn label="Insert image (or paste / drop one)" onClick={() => imgRef.current?.click()}><ImagePlus size={15} /></IconBtn>
          {toolBtn('laser', 'Laser pointer', <Zap size={15} />, 'K')}
        </div>
        {mermaidModal}{helpModal}
      </div>
    )
  }

  return (
    <div ref={fs.ref} className={cn('flex flex-col gap-2', fs.on && 'h-full', fs.cls)} data-testid="diagram-editor">
      {hiddenInputs}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border bg-card p-1.5" role="toolbar" aria-label="Diagram toolbar">
        {fileMenu}
        <span className="mx-0.5 h-5 w-px bg-border" />
        {undoRedo}
        <span className="mx-0.5 h-5 w-px bg-border" />
        {toolBtn('select', 'Select', <MousePointer2 size={15} />)}{toolBtn('hand', 'Pan (hold Space)', <Hand size={15} />)}{toolBtn('connector', 'Connector tool', <Spline size={15} />)}{toolBtn('line', 'Line', <Minus size={15} />)}{toolBtn('pen', 'Freehand pen', <Pen size={15} />)}{toolBtn('text', 'Text', <Type size={15} />)}
        <IconBtn label="Insert image" onClick={() => imgRef.current?.click()}><ImagePlus size={15} /></IconBtn>
        <button type="button" aria-pressed={libOpen} onClick={() => setLibOpen(!libOpen)} className={cn(btn, 'lg:hidden', libOpen && btnOn)}><Shapes size={14} />Shapes</button>
        <span className="mx-0.5 h-5 w-px bg-border" />
        <Menu label="Templates" icon={<LayoutTemplate size={14} />} testid="templates-menu">
          {(close) => (<>{TEMPLATES.map((t) => <MenuItem key={t.name} onClick={() => { close(); insertEls(t.build(), false, false) }}><span><b className="font-medium">{t.name}</b><span className="block text-[11px] text-muted-foreground">{t.description}</span></span></MenuItem>)}<MenuSep /><MenuItem onClick={() => { close(); setModal('mermaid') }}><span className="flex items-center gap-2"><Network size={14} />Insert from Mermaid…</span></MenuItem></>)}
        </Menu>
        <Menu label="Layout" icon={<Wand2 size={14} />} testid="layout-menu">
          {(close) => (<>{([['TB', 'Auto-layout top → bottom'], ['LR', 'Auto-layout left → right'], ['BT', 'Auto-layout bottom → top'], ['RL', 'Auto-layout right → left']] as const).map(([dir, l]) => <MenuItem key={dir} onClick={() => { close(); const ids = selRef.current.length > 1 ? selRef.current : null; apply((c) => autoLayout(c, ids, dir)); window.setTimeout(fitAll, 0) }}>{l}</MenuItem>)}<MenuSep /><MenuItem onClick={() => { close(); apply((c) => c.map((e) => (e.t === 'edge' ? { ...e, bend: 0.5 } : e))) }}>Reset connector bends</MenuItem></>)}
        </Menu>
        <span className="mx-0.5 h-5 w-px bg-border" />
        <IconBtn label="Toggle grid" on={doc.grid} onClick={() => setPage({ grid: !doc.grid })}><Grid3x3 size={14} /></IconBtn>
        <IconBtn label="Snap to grid and guides" on={doc.snap} onClick={() => setPage({ snap: !doc.snap })}><Magnet size={14} /></IconBtn>
        <IconBtn label="Keyboard shortcuts (?)" onClick={() => setModal('help')}><Keyboard size={14} /></IconBtn>
        {fsBtn}
        <div className="ml-auto flex items-center gap-2 px-1">{status}</div>
      </div>
      {libOpen && <div className="h-64 overflow-hidden rounded-xl border bg-card lg:hidden"><Library onAdd={(it) => { dropItem(it); setLibOpen(false) }} onDragStart={(it, e) => { e.dataTransfer.setData('application/x-devpocket-lib', JSON.stringify(it)) }} /></div>}
      <div className={cn('flex flex-col overflow-hidden rounded-xl border bg-card lg:flex-row', fs.on ? 'min-h-0 flex-1' : 'h-[calc(100vh-250px)] min-h-[560px]')}>
        <aside className="hidden w-56 shrink-0 border-r lg:block" aria-label="Shape library"><Library onAdd={(it) => dropItem(it)} onDragStart={(it, e) => { e.dataTransfer.setData('application/x-devpocket-lib', JSON.stringify(it)); e.dataTransfer.effectAllowed = 'copy' }} /></aside>
        <div className="relative min-h-[360px] min-w-0 flex-1">{canvas}</div>
        <aside className="scroll-thin max-h-72 w-full shrink-0 overflow-y-auto border-t lg:max-h-none lg:w-64 lg:border-l lg:border-t-0" aria-label="Format panel">{props}</aside>
      </div>
      {mermaidModal}{helpModal}
    </div>
  )
}

const MERMAID_SAMPLE = `flowchart TD
  A([Start]) --> B{Signed in?}
  B -- yes --> C[Show dashboard]
  B -- no --> D[Login form]
  D --> E[(Check credentials)]
  E -->|ok| C
  E -->|fail| D
  C --> F((Done))`
function MermaidModal({ onClose, onInsert }: { onClose: () => void; onInsert: (els: El[], replace: boolean) => void }) {
  const [src, setSrc] = useState(MERMAID_SAMPLE); const [replace, setReplace] = useState(false)
  const [dir, setDir] = useState('')
  const res = useMemo(() => { try { const g = parseMermaidFlowchart(src); if (dir) g.dir = dir as 'TB'; return { g, err: '' } } catch (e) { return { g: null, err: (e as Error).message } } }, [src, dir])
  return (
    <Modal title="Insert from Mermaid" onClose={onClose}>
      <p className="mb-2 text-sm text-muted-foreground">Paste a Mermaid <b>flowchart</b> and it becomes fully editable shapes and connectors, auto-laid out.</p>
      <textarea aria-label="Mermaid flowchart" value={src} onChange={(e) => setSrc(e.target.value)} rows={11} spellCheck={false} className="mono w-full rounded-md border bg-card p-2 text-[13px]" />
      {res.err && <p role="alert" className="mt-1 text-sm text-destructive">{res.err}</p>}
      {res.g && <p className="mt-1 text-xs text-muted-foreground">{res.g.nodes.length} nodes, {res.g.edges.length} connections</p>}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-sm">Direction<select aria-label="Direction" value={dir} onChange={(e) => setDir(e.target.value)} className="h-8 rounded-md border bg-card px-2 text-sm"><option value="">As written</option><option value="TB">Top → bottom</option><option value="LR">Left → right</option></select></label>
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />Replace canvas</label>
        <button type="button" className={cn(btn, btnOn, 'ml-auto px-4')} disabled={!res.g} onClick={() => res.g && onInsert(graphToEls(res.g), replace)} data-testid="mermaid-insert">Insert</button>
      </div>
    </Modal>
  )
}
function HelpModal({ wb, onClose }: { wb: boolean; onClose: () => void }) {
  const rows: [string, string][] = [
    ['Pan', 'Hold Space and drag · middle mouse · scroll · two-finger drag'], ['Zoom', 'Ctrl/⌘ + scroll · pinch · Ctrl/⌘ +/−/0'], ['Fit to screen / selection', 'Shift+1 / Shift+2'],
    ['Select', 'Click · Shift+click adds · drag a box · Ctrl/⌘+A'], ['Move / duplicate', 'Drag · Alt+drag duplicates · arrow keys nudge (Shift = 10)'], ['Edit text', wb ? 'Double-click or Enter' : 'Double-click, Enter, or just start typing'],
    ['Connect shapes', 'Hover a shape and drag a blue arrow to another shape (click it to add a connected copy)'], ['Undo / redo', 'Ctrl/⌘+Z · Shift+Ctrl/⌘+Z or Ctrl/⌘+Y'], ['Copy / paste / duplicate', 'Ctrl/⌘ + C / V / D (paste images and Mermaid flowcharts too)'],
    ['Group / ungroup', 'Ctrl/⌘+G · Shift+Ctrl/⌘+G'], ['Layer order', 'Ctrl/⌘+] / [  (add Shift for front/back)'], ['Delete', 'Delete or Backspace'], ['Save', 'Ctrl/⌘+S saves a file'],
    ...(wb ? ([['Tools', 'V select · H pan · P pen · U highlighter · E eraser · L line · A arrow · T text · N sticky · K laser · R/O/D shapes']] as [string, string][]) : []),
  ]
  return <Modal title="Keyboard shortcuts & tips" onClose={onClose}><dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[170px_1fr]">{rows.map(([a, b]) => <div key={a} className="contents"><dt className="font-medium">{a}</dt><dd className="text-muted-foreground">{b}</dd></div>)}</dl><p className="mt-3 text-xs text-muted-foreground"><ChevronsLeftRight size={12} className="mr-1 inline" />Drawings are autosaved in this browser only and never uploaded. Use File → Save to keep a copy.</p></Modal>
}
