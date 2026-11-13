import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignHorizontalSpaceAround, AlignLeft, AlignRight, AlignCenter, AlignStartHorizontal, AlignStartVertical, AlignVerticalSpaceAround, Bold, BringToFront, ChevronDown, Group, Italic, Lock, SendToBack, Trash2, Ungroup, Unlock, X, ArrowUp, ArrowDown, Search } from 'lucide-react'
import type { AlignMode } from '@/lib/draw/geom'
import { nodeMap } from '@/lib/draw/geom'
import type { ArrowKind, Dash, El, EdgeEl, FontKey, Route, ShapeKind, Style } from '@/lib/draw/types'
import { defaultStyle } from '@/lib/draw/types'
import { ICON_LABELS, ICONS } from '@/lib/draw/shapes'
import { newShape } from '@/lib/draw/scene'
import { cn } from '@/lib/cn'
import { SceneDefs, SceneView } from './SceneView'

// ---------- shared bits ----------
export const PALETTE = ['#1f2937', '#6b7280', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff']
export const FILLS = ['#ffffff', '#f3f4f6', '#fee2e2', '#ffedd5', '#fef9c3', '#dcfce7', '#ccfbf1', '#dbeafe', '#ede9fe', '#fce7f3']
export const STICKY = ['#fef08a', '#fbcfe8', '#bfdbfe', '#bbf7d0', '#fed7aa', '#ddd6fe']

export const btn = 'inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md border bg-card px-2 text-[13px] font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40'
export const btnOn = 'border-primary bg-accent text-primary'
export function IconBtn({ label, on, onClick, children, disabled, className }: { label: string; on?: boolean; onClick?: () => void; children: ReactNode; disabled?: boolean; className?: string }) {
  return <button type="button" title={label} aria-label={label} aria-pressed={on} disabled={disabled} onClick={onClick} className={cn(btn, 'w-8 px-0', on && btnOn, className)}>{children}</button>
}

export function Menu({ label, icon, children, align = 'left', testid, up }: { label: string; icon?: ReactNode; children: (close: () => void) => ReactNode; align?: 'left' | 'right'; testid?: string; up?: boolean }) {
  const [open, setOpen] = useState(false); const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('pointerdown', h); window.addEventListener('keydown', k); return () => { window.removeEventListener('pointerdown', h); window.removeEventListener('keydown', k) }
  }, [open])
  return (
    <div className="relative" ref={ref}>
      <button type="button" className={cn(btn, open && btnOn)} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} data-testid={testid}>{icon}{label}<ChevronDown size={13} /></button>
      {open && <div role="menu" className={cn('absolute z-40 min-w-52 rounded-lg border bg-card p-1 shadow-lg', up ? 'bottom-full mb-1' : 'mt-1', align === 'right' ? 'right-0' : 'left-0')}>{children(() => setOpen(false))}</div>}
    </div>
  )
}
export const MenuItem = ({ children, onClick, hint, disabled }: { children: ReactNode; onClick: () => void; hint?: string; disabled?: boolean }) => (
  <button role="menuitem" type="button" disabled={disabled} onClick={onClick} className="flex w-full cursor-pointer items-center justify-between gap-6 rounded-md px-2.5 py-1.5 text-left text-[13px] hover:bg-muted disabled:opacity-40">{children}{hint && <kbd className="text-[11px] text-muted-foreground">{hint}</kbd>}</button>
)
export const MenuSep = () => <div className="my-1 h-px bg-border" />

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" aria-label={title} className={cn('max-h-[88vh] w-full overflow-auto rounded-xl border bg-card p-4 shadow-2xl', wide ? 'max-w-3xl' : 'max-w-lg')}>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-base font-semibold">{title}</h2><IconBtn label="Close" onClick={onClose}><X size={15} /></IconBtn></div>
        {children}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="border-b p-3 last:border-b-0"><h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3><div className="flex flex-col gap-2.5">{children}</div></section>
}
function Row({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex items-center gap-2"><span className="w-14 shrink-0 text-xs text-muted-foreground">{label}</span><div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">{children}</div></div>
}
export function ColorField({ label, value, onChange, colors, none }: { label: string; value: string; onChange: (c: string) => void; colors: string[]; none?: boolean }) {
  const custom = value !== 'none' && !colors.includes(value)
  return (
    <Row label={label}>
      {none && <button type="button" aria-label={`${label}: none`} title="None" onClick={() => onChange('none')} className={cn('relative h-5 w-5 cursor-pointer rounded-full border bg-card', value === 'none' && 'ring-2 ring-primary ring-offset-1 ring-offset-card')}><span className="absolute left-1/2 top-0 h-full w-px rotate-45 bg-destructive" /></button>}
      {colors.map((c) => <button key={c} type="button" aria-label={`${label} ${c}`} title={c} onClick={() => onChange(c)} className={cn('h-5 w-5 cursor-pointer rounded-full border border-black/15', value === c && 'ring-2 ring-primary ring-offset-1 ring-offset-card')} style={{ background: c }} />)}
      <label title="Custom colour" className={cn('relative h-5 w-5 cursor-pointer overflow-hidden rounded-full border border-black/15', custom && 'ring-2 ring-primary ring-offset-1 ring-offset-card')} style={{ background: custom ? value : 'conic-gradient(red,yellow,lime,aqua,blue,magenta,red)' }}>
        <input type="color" aria-label={`${label} custom`} value={custom ? value : '#3b82f6'} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
      </label>
    </Row>
  )
}
const Seg = <T extends string | number>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: [T, ReactNode, string][]; label: string }) => (
  <div role="group" aria-label={label} className="inline-flex rounded-md border bg-muted p-0.5">
    {items.map(([k, node, t]) => <button key={String(k)} type="button" title={t} aria-label={t} aria-pressed={value === k} onClick={() => onChange(k)} className={cn('inline-flex h-6 min-w-7 cursor-pointer items-center justify-center rounded px-1.5 text-xs', value === k ? 'bg-card font-semibold shadow-sm' : 'text-muted-foreground hover:text-foreground')}>{node}</button>)}
  </div>
)
const Num = ({ label, value, onChange, step = 1, min, max }: { label: string; value: number; onChange: (n: number) => void; step?: number; min?: number; max?: number }) => (
  <label className="flex items-center gap-1 text-xs text-muted-foreground">{label}<input aria-label={label} type="number" value={Math.round(value * 100) / 100} step={step} min={min} max={max} onChange={(e) => { const n = parseFloat(e.target.value); if (Number.isFinite(n)) onChange(n) }} className="h-7 w-16 rounded-md border bg-card px-1.5 text-xs text-foreground" /></label>
)

// ---------- format panel ----------
export interface Defaults { s: Style; route: Route; head: ArrowKind; tail: ArrowKind }
export interface PropsApi {
  style: (p: Partial<Style>) => void
  edge: (p: Partial<Pick<EdgeEl, 'route' | 'head' | 'tail'>>) => void
  geom: (p: { x?: number; y?: number; w?: number; h?: number }) => void
  arrange: (a: 'front' | 'back' | 'forward' | 'backward' | 'group' | 'ungroup' | 'lock' | 'delete' | AlignMode | 'dist-h' | 'dist-v') => void
  page: (p: { bg?: string; grid?: boolean; gridSize?: number; snap?: boolean }) => void
}
const ARROWS: [ArrowKind, string][] = [['none', 'None'], ['arrow', 'Arrow'], ['triangle', 'Filled triangle'], ['open', 'Open triangle'], ['diamond', 'Diamond'], ['dot', 'Dot'], ['bar', 'Bar']]
const ARROW_GLYPH: Record<ArrowKind, string> = { none: '—', arrow: '→', triangle: '▶', open: '▷', diamond: '◆', dot: '●', bar: '┤' }

export function PropsPanel({ sel, defaults, api, page, showPage, mode }: { sel: El[]; defaults: Defaults; api: PropsApi; page: { bg: string; grid: boolean; gridSize: number; snap: boolean }; showPage: boolean; mode: 'diagram' | 'whiteboard' }) {
  const shapes = sel.filter((e) => e.t === 'shape'), edges = sel.filter((e): e is EdgeEl => e.t === 'edge'), strokes = sel.filter((e) => e.t === 'stroke'), nodes = sel.filter((e) => e.t === 'shape' || e.t === 'image')
  const none = sel.length === 0
  const first = sel[0]; const s: Style = first ? first.s : defaults.s
  const showFill = none || shapes.length > 0
  const showText = none || shapes.length > 0 || edges.length > 0
  const showEdge = none || edges.length > 0
  const edge = edges[0]; const route = edge?.route ?? defaults.route, head = edge?.head ?? defaults.head, tail = edge?.tail ?? defaults.tail
  const hl = strokes.length > 0 && strokes.every((e) => e.t === 'stroke' && e.hl)
  const one = sel.length === 1 ? sel[0] : null
  const geomEl = one && (one.t === 'shape' || one.t === 'image') ? one : null
  return (
    <div className="flex flex-col" data-testid="props-panel">
      <Section title={none ? 'Style for new items' : `${sel.length} selected`}>
        {showFill && <ColorField label="Fill" value={s.fill} onChange={(c) => api.style({ fill: c })} colors={FILLS} none />}
        <ColorField label={strokes.length && !shapes.length && !edges.length ? 'Colour' : 'Stroke'} value={s.stroke} onChange={(c) => api.style({ stroke: c })} colors={PALETTE} none={!strokes.length || shapes.length > 0} />
        <Row label="Width"><Seg label="Stroke width" value={s.sw} onChange={(v) => api.style({ sw: v })} items={hl ? [[10, '10', 'Thin'], [18, '18', 'Medium'], [28, '28', 'Wide']] : [[1, '1', 'Hairline'], [2, '2', 'Thin'], [4, '4', 'Medium'], [7, '7', 'Thick']]} /></Row>
        {!hl && !strokes.length && <Row label="Line"><Seg<Dash> label="Line style" value={s.dash} onChange={(v) => api.style({ dash: v })} items={[['solid', '━', 'Solid'], ['dashed', '╍', 'Dashed'], ['dotted', '┈', 'Dotted']]} /></Row>}
        <Row label="Opacity"><input aria-label="Opacity" type="range" min={5} max={100} value={Math.round(s.opacity * 100)} onChange={(e) => api.style({ opacity: +e.target.value / 100 })} className="h-1.5 flex-1 accent-[var(--primary)]" /><span className="w-8 text-right text-xs tabular-nums">{Math.round(s.opacity * 100)}%</span></Row>
        {(none || nodes.length > 0 || edges.length > 0) && <Row label="Look"><Seg<string> label="Drawing style" value={s.sketch ? 'sketch' : 'clean'} onChange={(v) => api.style({ sketch: v === 'sketch' })} items={[['clean', 'Clean', 'Clean'], ['sketch', '✎ Sketch', 'Hand-drawn']]} />{(none || shapes.length > 0) && <button type="button" aria-pressed={s.shadow} onClick={() => api.style({ shadow: !s.shadow })} className={cn(btn, 'h-6 px-2 text-xs', s.shadow && btnOn)}>Shadow</button>}</Row>}
        {(none || shapes.some((e) => e.t === 'shape' && e.kind === 'rect')) && <Row label="Corners"><input aria-label="Corner radius" type="range" min={0} max={60} value={Math.min(60, s.radius)} onChange={(e) => api.style({ radius: +e.target.value })} className="h-1.5 flex-1 accent-[var(--primary)]" /><span className="w-8 text-right text-xs tabular-nums">{Math.min(60, s.radius)}</span></Row>}
      </Section>
      {showText && (
        <Section title="Text">
          <Row label="Font"><select aria-label="Font" value={s.font} onChange={(e) => api.style({ font: e.target.value as FontKey })} className="h-7 flex-1 rounded-md border bg-card px-1.5 text-xs"><option value="sans">Sans</option><option value="serif">Serif</option><option value="mono">Mono</option><option value="hand">Handwritten</option></select><input aria-label="Font size" type="number" min={8} max={96} value={s.fs} onChange={(e) => { const n = +e.target.value; if (n >= 6) api.style({ fs: n }) }} className="h-7 w-14 rounded-md border bg-card px-1.5 text-xs" /></Row>
          <Row label="Style"><IconBtn label="Bold" on={s.bold} onClick={() => api.style({ bold: !s.bold })} className="h-6 w-7"><Bold size={13} /></IconBtn><IconBtn label="Italic" on={s.italic} onClick={() => api.style({ italic: !s.italic })} className="h-6 w-7"><Italic size={13} /></IconBtn><Seg<Style['align']> label="Alignment" value={s.align} onChange={(v) => api.style({ align: v })} items={[['left', <AlignLeft size={13} key="l" />, 'Text align left'], ['center', <AlignCenter size={13} key="c" />, 'Text align centre'], ['right', <AlignRight size={13} key="r" />, 'Text align right']]} /></Row>
          <ColorField label="Colour" value={s.color} onChange={(c) => api.style({ color: c })} colors={PALETTE} />
        </Section>
      )}
      {showEdge && (
        <Section title="Connector">
          <Row label="Routing"><Seg<Route> label="Routing" value={route} onChange={(v) => api.edge({ route: v })} items={[['orth', 'Elbow', 'Elbow connector'], ['straight', 'Straight', 'Straight line'], ['curve', 'Curved', 'Curved line']]} /></Row>
          <Row label="Start"><Seg<ArrowKind> label="Start arrow" value={tail} onChange={(v) => api.edge({ tail: v })} items={ARROWS.map(([k, t]) => [k, ARROW_GLYPH[k], t])} /></Row>
          <Row label="End"><Seg<ArrowKind> label="End arrow" value={head} onChange={(v) => api.edge({ head: v })} items={ARROWS.map(([k, t]) => [k, ARROW_GLYPH[k], t])} /></Row>
        </Section>
      )}
      {geomEl && (
        <Section title="Size & position">
          <div className="grid grid-cols-2 gap-1.5"><Num label="X" value={geomEl.x} onChange={(v) => api.geom({ x: v })} /><Num label="Y" value={geomEl.y} onChange={(v) => api.geom({ y: v })} /><Num label="W" value={geomEl.w} min={4} onChange={(v) => api.geom({ w: Math.max(4, v) })} /><Num label="H" value={geomEl.h} min={4} onChange={(v) => api.geom({ h: Math.max(4, v) })} /></div>
        </Section>
      )}
      {!none && (
        <Section title="Arrange">
          <div className="flex flex-wrap gap-1">
            <IconBtn label="Bring to front" onClick={() => api.arrange('front')}><BringToFront size={14} /></IconBtn>
            <IconBtn label="Bring forward" onClick={() => api.arrange('forward')}><ArrowUp size={14} /></IconBtn>
            <IconBtn label="Send backward" onClick={() => api.arrange('backward')}><ArrowDown size={14} /></IconBtn>
            <IconBtn label="Send to back" onClick={() => api.arrange('back')}><SendToBack size={14} /></IconBtn>
            <IconBtn label="Group" onClick={() => api.arrange('group')} disabled={sel.length < 2}><Group size={14} /></IconBtn>
            <IconBtn label="Ungroup" onClick={() => api.arrange('ungroup')} disabled={!sel.some((e) => e.g)}><Ungroup size={14} /></IconBtn>
            <IconBtn label={sel.every((e) => e.lock) ? 'Unlock' : 'Lock'} on={sel.every((e) => e.lock)} onClick={() => api.arrange('lock')}>{sel.every((e) => e.lock) ? <Unlock size={14} /> : <Lock size={14} />}</IconBtn>
            <IconBtn label="Delete" onClick={() => api.arrange('delete')} className="text-destructive"><Trash2 size={14} /></IconBtn>
          </div>
          {sel.length > 1 && (
            <div className="flex flex-wrap gap-1">
              {([['left', AlignStartHorizontal], ['center', AlignCenterHorizontal], ['right', AlignEndHorizontal], ['top', AlignStartVertical], ['middle', AlignCenterVertical], ['bottom', AlignEndVertical]] as const).map(([m, I]) => <IconBtn key={m} label={`Align objects ${m}`} onClick={() => api.arrange(m)}><I size={14} /></IconBtn>)}
              <IconBtn label="Distribute horizontally" onClick={() => api.arrange('dist-h')} disabled={sel.length < 3}><AlignHorizontalSpaceAround size={14} /></IconBtn>
              <IconBtn label="Distribute vertically" onClick={() => api.arrange('dist-v')} disabled={sel.length < 3}><AlignVerticalSpaceAround size={14} /></IconBtn>
            </div>
          )}
        </Section>
      )}
      {none && showPage && (
        <Section title="Canvas">
          <ColorField label="Background" value={page.bg} onChange={(c) => api.page({ bg: c })} colors={['#ffffff', '#f8fafc', '#fffbeb', '#f0fdf4', '#1e1e1e', '#0f172a']} />
          {mode === 'diagram' && <>
            <Row label="Grid"><button type="button" aria-pressed={page.grid} onClick={() => api.page({ grid: !page.grid })} className={cn(btn, 'h-6 px-2 text-xs', page.grid && btnOn)}>Show grid</button><button type="button" aria-pressed={page.snap} onClick={() => api.page({ snap: !page.snap })} className={cn(btn, 'h-6 px-2 text-xs', page.snap && btnOn)}>Snap</button></Row>
            <Row label="Grid size"><Seg label="Grid size" value={page.gridSize} onChange={(v) => api.page({ gridSize: v })} items={[[10, '10', '10 px'], [20, '20', '20 px'], [40, '40', '40 px']]} /></Row>
          </>}
        </Section>
      )}
    </div>
  )
}

// ---------- shape library ----------
export interface LibItem { id: string; label: string; kind: ShapeKind; w: number; h: number; text?: string; ic?: string; s?: Partial<Style> }
const P = (id: string, label: string, kind: ShapeKind, w: number, h: number, o: Partial<LibItem> = {}): LibItem => ({ id, label, kind, w, h, ...o })
const FC = { fill: '#e0e7ff', stroke: '#4f46e5' }
export const LIBRARY: { name: string; items: LibItem[] }[] = [
  { name: 'General', items: [
    P('rect', 'Rectangle', 'rect', 120, 70), P('round', 'Rounded', 'rect', 120, 70, { s: { radius: 16 } }), P('square', 'Square', 'rect', 80, 80), P('circle', 'Circle', 'ellipse', 80, 80), P('ellipse', 'Ellipse', 'ellipse', 130, 76),
    P('diamond', 'Diamond', 'diamond', 120, 84), P('triangle', 'Triangle', 'triangle', 100, 90), P('hexagon', 'Hexagon', 'hexagon', 120, 80), P('parallelogram', 'Parallelogram', 'parallelogram', 130, 70), P('trapezoid', 'Trapezoid', 'trapezoid', 130, 70),
    P('cylinder', 'Cylinder', 'cylinder', 80, 104), P('cloud', 'Cloud', 'cloud', 140, 90), P('star', 'Star', 'star', 100, 96), P('callout', 'Callout', 'callout', 130, 90), P('chevron', 'Chevron', 'chevron', 130, 60),
    P('note', 'Sticky note', 'note', 140, 120, { text: 'Note', s: { fill: '#fef08a', stroke: 'none', shadow: true, sw: 0 } }), P('text', 'Text', 'text', 100, 30, { text: 'Text', s: { fill: 'none', stroke: 'none' } }),
  ] },
  { name: 'Flowchart', items: [
    P('fc-start', 'Terminator', 'rect', 130, 54, { text: 'Start', s: { ...FC, fill: '#dcfce7', stroke: '#16a34a', radius: 999 } }), P('fc-process', 'Process', 'rect', 130, 64, { text: 'Process', s: FC }), P('fc-decision', 'Decision', 'diamond', 130, 90, { text: 'Yes / No?', s: { fill: '#fef9c3', stroke: '#ca8a04' } }),
    P('fc-data', 'Input / Output', 'parallelogram', 140, 64, { text: 'Data', s: FC }), P('fc-doc', 'Document', 'document', 130, 72, { text: 'Document', s: FC }), P('fc-sub', 'Predefined process', 'process', 140, 64, { text: 'Sub-process', s: FC }),
    P('fc-db', 'Database', 'cylinder', 80, 104, { text: 'DB', s: { fill: '#f1f5f9', stroke: '#475569' } }), P('fc-conn', 'Connector', 'ellipse', 44, 44, { text: 'A', s: FC }), P('fc-step', 'Step', 'chevron', 140, 60, { text: 'Step', s: FC }),
  ] },
  { name: 'UML', items: [
    P('uml-actor', 'Actor', 'actor', 56, 100, { text: 'Actor', s: { fill: 'none' } }), P('uml-class', 'Class', 'class', 170, 120, { text: 'ClassName\n+ id: int\n+ name: string\n---\n+ save(): void', s: { fill: '#fff7ed', stroke: '#c2410c', fs: 14 } }),
    P('uml-usecase', 'Use case', 'ellipse', 150, 70, { text: 'Use case', s: { fill: '#f0fdf4', stroke: '#16a34a' } }), P('uml-package', 'Package', 'package', 160, 110, { text: 'Package', s: { fill: '#f5f3ff', stroke: '#7c3aed' } }), P('uml-component', 'Component', 'rect', 150, 70, { text: '«component»\nName', s: { fill: '#ecfeff', stroke: '#0891b2' } }),
    P('uml-note', 'Note', 'callout', 140, 80, { text: 'Note', s: { fill: '#fef9c3', stroke: '#ca8a04' } }),
  ] },
  { name: 'Architecture', items: Object.keys(ICONS).map((k) => P(`ic-${k}`, ICON_LABELS[k] ?? k, 'icon', 84, 92, { ic: k, text: ICON_LABELS[k] ?? k, s: { fill: 'none', stroke: '#4f46e5', sw: 2, fs: 13 } })) },
]
export const libToShape = (it: LibItem, x: number, y: number, base: Style) => newShape(it.kind, x, y, it.w, it.h, { text: it.text ?? '', ic: it.ic, s: { ...base, fill: base.fill, ...(it.kind === 'text' || it.kind === 'icon' ? { fill: 'none' } : {}), ...it.s } })

function Thumb({ item }: { item: LibItem }) {
  const el = useMemo(() => { const sh = newShape(item.kind, 0, 0, item.w, item.h, { text: item.text ?? '', ic: item.ic, s: { ...defaultStyle(), fs: 14, ...(item.kind === 'text' ? { fill: 'none', stroke: 'none' } : {}), ...item.s } }); return sh }, [item])
  const pad = 6; const nodes = nodeMap([el])
  return (
    <svg viewBox={`${-pad} ${-pad} ${item.w + pad * 2} ${item.h + pad * 2}`} width="44" height="36" aria-hidden="true" className="pointer-events-none">
      <SceneDefs uid="thumb" /><SceneView els={[el]} nodes={nodes} ctx={{ uid: 'thumb', bg: '#fff' }} />
    </svg>
  )
}
export function Library({ onAdd, onDragStart }: { onAdd: (item: LibItem) => void; onDragStart: (item: LibItem, e: React.DragEvent) => void }) {
  const [q, setQ] = useState(''); const [closed, setClosed] = useState<Set<string>>(new Set())
  const f = q.trim().toLowerCase()
  return (
    <div className="flex h-full flex-col" data-testid="library">
      <div className="relative border-b p-2"><Search size={13} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" /><input aria-label="Search shapes" placeholder="Search shapes" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 w-full rounded-md border bg-card pl-7 pr-2 text-[13px]" /></div>
      <div className="scroll-thin flex-1 overflow-y-auto p-2">
        {LIBRARY.map((cat) => {
          const items = f ? cat.items.filter((i) => i.label.toLowerCase().includes(f) || cat.name.toLowerCase().includes(f)) : cat.items
          if (!items.length) return null; const open = f ? true : !closed.has(cat.name)
          return (
            <div key={cat.name} className="mb-2">
              <button type="button" aria-expanded={open} onClick={() => setClosed((c) => { const n = new Set(c); if (n.has(cat.name)) n.delete(cat.name); else n.add(cat.name); return n })} className="flex w-full cursor-pointer items-center gap-1 px-1 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><ChevronDown size={12} className={cn('transition-transform', !open && '-rotate-90')} />{cat.name}</button>
              {open && <div className="grid grid-cols-3 gap-1">{items.map((it) => (
                <button key={it.id} type="button" draggable title={`${it.label} — click or drag onto the canvas`} aria-label={cat.name === 'Architecture' ? `Add ${it.label} icon` : `Add ${it.label}`} data-lib={it.id} onClick={() => onAdd(it)} onDragStart={(e) => onDragStart(it, e)} className="flex h-[58px] cursor-grab flex-col items-center justify-center gap-0.5 overflow-hidden rounded-md border border-transparent p-1 hover:border-primary hover:bg-accent">
                  <span className="rounded bg-white px-0.5"><Thumb item={it} /></span><span className="w-full truncate text-center text-[10px] text-muted-foreground">{it.label}</span>
                </button>))}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
