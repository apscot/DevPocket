import { memo } from 'react'
import type { EdgeEl, El, ImageEl, Node, ShapeEl, StrokeEl, Style } from '@/lib/draw/types'
import { DEFAULT_INK, FONTS } from '@/lib/draw/types'
import { arrowHead, edgeGeo, hashSeed, polyPathD, roughPath, strokeLine, strokeOutline, textSize } from '@/lib/draw/geom'
import { ICONS, labelBelow, rectRadius, shapeGeom } from '@/lib/draw/shapes'
import { lineHeight, wrap } from '@/lib/draw/text'

export interface Ctx { uid: string; bg: string; dark?: boolean }
/** The default ink adapts to dark canvases; explicit colours are never touched. */
const ink = (c: string, ctx: Ctx, onFill = 'none') => (ctx.dark && c === DEFAULT_INK && onFill === 'none' ? '#f1f5f9' : c)
const dashOf = (s: Style) => (s.dash === 'dashed' ? `${s.sw * 3 + 2} ${s.sw * 2 + 2}` : s.dash === 'dotted' ? `0.1 ${s.sw * 2 + 1}` : undefined)
const fontProps = (s: Style) => ({ fontFamily: FONTS[s.font], fontSize: s.fs, fontWeight: s.bold ? 700 : 400, fontStyle: s.italic ? 'italic' : 'normal' })

export function SceneDefs({ uid }: { uid: string }) {
  return (
    <defs>
      <filter id={`${uid}-sh`} x="-20%" y="-20%" width="150%" height="160%"><feDropShadow dx="2" dy="3" stdDeviation="3" floodColor="#000" floodOpacity="0.25" /></filter>
    </defs>
  )
}

function TextLines({ lines, x, y, w, h, s, anchorTop, align, bold }: { lines: string[]; x: number; y: number; w: number; h: number; s: Style; anchorTop?: boolean; align?: Style['align']; bold?: boolean }) {
  if (!lines.length || (lines.length === 1 && !lines[0])) return null
  const lh = lineHeight(s.fs); const total = lines.length * lh
  const y0 = anchorTop ? y : y + (h - total) / 2; const a = align ?? s.align
  const tx = a === 'left' ? x : a === 'right' ? x + w : x + w / 2
  return (
    <text {...fontProps(s)} fontWeight={bold ? 700 : s.bold ? 700 : 400} fill={s.color} textAnchor={a === 'left' ? 'start' : a === 'right' ? 'end' : 'middle'} style={{ userSelect: 'none', whiteSpace: 'pre' }}>
      {lines.map((l, i) => <tspan key={i} x={tx} y={y0 + i * lh + s.fs * 0.82}>{l || ' '}</tspan>)}
    </text>
  )
}

export const ShapeView = memo(function ShapeView({ el, ctx }: { el: ShapeEl; ctx: Ctx }) {
  const s = el.s; const g = shapeGeom(el.kind, el.w, el.h); const sw = s.sw
  const fill = s.fill === 'none' ? 'none' : s.fill; const stroke = s.stroke === 'none' ? 'none' : ink(s.stroke, ctx, fill)
  const ts: Style = { ...s, color: ink(s.color, ctx, fill) }
  const common = { fill, stroke, strokeWidth: sw, strokeDasharray: dashOf(s), strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  const rr = rectRadius(s, el.w, el.h)
  const seed = hashSeed(el.id)
  let body: React.ReactNode = null
  if (s.sketch && g.rough && g.prim !== 'none') {
    body = <>{fill !== 'none' && <path d={polyPathD(g.poly)} fill={fill} stroke="none" />}{stroke !== 'none' && <path d={roughPath(g.poly, true, seed)} fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeDasharray={dashOf(s)} />}</>
  } else if (g.prim === 'rect') body = <rect width={el.w} height={el.h} rx={el.kind === 'note' ? 2 : rr} {...common} />
  else if (g.prim === 'ellipse') body = <ellipse cx={el.w / 2} cy={el.h / 2} rx={el.w / 2} ry={el.h / 2} {...common} />
  else if (g.prim === 'path') body = <path d={g.d} {...common} />
  else body = <rect width={el.w} height={el.h} fill="transparent" stroke="none" />
  const details = g.details.map((d, i) => <path key={i} d={d} fill={el.kind === 'actor' ? 'none' : 'none'} stroke={stroke === 'none' ? ts.color : stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />)

  let label: React.ReactNode = null
  if (el.text) {
    const pad = el.kind === 'text' ? 2 : 6
    if (el.kind === 'class') {
      const head = Math.min(30, el.h * 0.34); const body2 = (el.h - head) / 2
      const parts = el.text.split('\n'); const name = parts[0]; const rest = parts.slice(1); const cut = rest.indexOf('---')
      const attrs = (cut < 0 ? rest : rest.slice(0, cut)).join('\n'), methods = cut < 0 ? '' : rest.slice(cut + 1).join('\n')
      const small = { ...ts, fs: Math.max(10, s.fs - 2) }
      label = <>
        <TextLines lines={wrap(name, el.w - 12, { ...s, bold: true })} x={6} y={0} w={el.w - 12} h={head} s={ts} bold />
        <TextLines lines={wrap(attrs, el.w - 16, small)} x={8} y={head + 4} w={el.w - 16} h={body2 - 6} s={small} anchorTop align="left" />
        <TextLines lines={wrap(methods, el.w - 16, small)} x={8} y={head + body2 + 4} w={el.w - 16} h={body2 - 6} s={small} anchorTop align="left" />
      </>
    } else {
      const b = g.text; const below = labelBelow(el.kind)
      const w = Math.max(10, b.w - pad * 2)
      label = <TextLines lines={wrap(el.text, w, s)} x={b.x + pad} y={b.y + (below ? 2 : 3)} w={w} h={Math.max(8, b.h - 6)} s={ts} anchorTop={below || el.kind === 'text'} />
    }
  }
  let icon: React.ReactNode = null
  if (el.kind === 'icon' && el.ic && ICONS[el.ic]) {
    const size = Math.min(el.w, el.h * 0.72); const k = size / 24
    icon = <g transform={`translate(${(el.w - size) / 2} 0) scale(${k})`} fill="none" stroke={stroke === 'none' ? ts.color : stroke} strokeWidth={Math.max(1, sw) / k} strokeLinecap="round" strokeLinejoin="round">{ICONS[el.ic].map((d, i) => <path key={i} d={d} />)}</g>
  }
  return (
    <g data-el={el.id} transform={`translate(${el.x} ${el.y})`} opacity={s.opacity} filter={s.shadow ? `url(#${ctx.uid}-sh)` : undefined}>
      {body}{details}{icon}{label}
    </g>
  )
})

export const EdgeView = memo(function EdgeView({ el, na, nb, ctx }: { el: EdgeEl; na?: Node; nb?: Node; ctx: Ctx }) {
  const nodes = new Map<string, Node>(); if (na && el.a.id) nodes.set(el.a.id, na); if (nb && el.b.id) nodes.set(el.b.id, nb)
  const g = edgeGeo(el, nodes); const s = el.s; const size = 9 + s.sw * 1.6
  const stroke = s.stroke === 'none' ? ink(DEFAULT_INK, ctx) : ink(s.stroke, ctx)
  const heads = [arrowHead(el.head, g.b, g.headDir, size), arrowHead(el.tail, g.a, g.tailDir, size)]
  const line = s.sketch ? roughPath(g.pts, false, hashSeed(el.id), 1.4) : g.d
  const t = el.text ? textSize(el.text, s) : null
  return (
    <g data-el={el.id} opacity={s.opacity}>
      <path d={line} fill="none" stroke={stroke} strokeWidth={s.sw} strokeDasharray={dashOf(s)} strokeLinecap="round" strokeLinejoin="round" />
      {heads.map((h, i) => h && <path key={i} d={h.d} fill={h.filled ? stroke : el.head === 'open' || el.tail === 'open' ? ctx.bg : 'none'} stroke={stroke} strokeWidth={s.sw} strokeLinejoin="round" strokeLinecap="round" />)}
      {t && el.text && (
        <g>
          <rect x={g.mid.x - t.w / 2 - 5} y={g.mid.y - t.h / 2 - 2} width={t.w + 10} height={t.h + 4} rx={4} fill={ctx.bg} opacity={0.92} />
          <TextLines lines={el.text.split('\n')} x={g.mid.x - t.w / 2 - 5} y={g.mid.y - t.h / 2 - 2} w={t.w + 10} h={t.h + 4} s={{ ...s, color: ink(s.color, ctx), align: 'center' }} />
        </g>
      )}
    </g>
  )
})

export const StrokeView = memo(function StrokeView({ el, ctx }: { el: StrokeEl; ctx: Ctx }) {
  const s = { ...el.s, stroke: ink(el.s.stroke, ctx) }
  if (el.hl) return <path data-el={el.id} d={strokeLine(el.pts)} fill="none" stroke={s.stroke} strokeWidth={s.sw} strokeLinecap="round" strokeLinejoin="round" opacity={s.opacity} style={{ mixBlendMode: ctx.dark ? 'screen' : 'multiply' }} />
  return <path data-el={el.id} d={strokeOutline(el.pts, s.sw)} fill={s.stroke} stroke={s.stroke} strokeWidth={0.4} strokeLinejoin="round" opacity={s.opacity} />
})

export const ImageView = memo(function ImageView({ el }: { el: ImageEl }) {
  return <image data-el={el.id} href={el.src} x={el.x} y={el.y} width={el.w} height={el.h} preserveAspectRatio="none" opacity={el.s.opacity} />
})

export function SceneView({ els, nodes, ctx, skip }: { els: El[]; nodes: Map<string, Node>; ctx: Ctx; skip?: Set<string> }) {
  return (
    <>
      {els.map((e) => {
        if (skip?.has(e.id)) return null
        switch (e.t) {
          case 'shape': return <ShapeView key={e.id} el={e} ctx={ctx} />
          case 'edge': return <EdgeView key={e.id} el={e} na={e.a.id ? nodes.get(e.a.id) : undefined} nb={e.b.id ? nodes.get(e.b.id) : undefined} ctx={ctx} />
          case 'stroke': return <StrokeView key={e.id} el={e} ctx={ctx} />
          case 'image': return <ImageView key={e.id} el={e} />
        }
      })}
    </>
  )
}
