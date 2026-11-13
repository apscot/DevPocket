import type { ArrowKind, Doc, EdgeEl, El, ShapeEl, ShapeKind, Style } from './types'
import { defaultStyle, emptyDoc } from './types'
import { edgeGeo, nodeMap } from './geom'
import { newEdge, newShape, uid } from './scene'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, '&#xa;')
const col = (c: string) => (c === 'none' ? 'none' : c)
const KIND_STYLE: Partial<Record<ShapeKind, string>> = {
  rect: '', ellipse: 'ellipse;', diamond: 'rhombus;', triangle: 'triangle;direction=north;', hexagon: 'shape=hexagon;perimeter=hexagonPerimeter2;', parallelogram: 'shape=parallelogram;perimeter=parallelogramPerimeter;',
  trapezoid: 'shape=trapezoid;perimeter=trapezoidPerimeter;', cylinder: 'shape=cylinder3;boundedLbl=1;backgroundOutline=1;size=15;', cloud: 'ellipse;shape=cloud;', document: 'shape=document;boundedLbl=1;',
  process: 'shape=process;', callout: 'shape=callout;perimeter=calloutPerimeter;', star: 'verticalLabelPosition=middle;shape=mxgraph.basic.star;', actor: 'shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;',
  package: 'shape=folder;tabWidth=40;tabHeight=14;tabPosition=left;', note: 'shape=note;size=14;', text: 'text;', chevron: 'shape=step;perimeter=stepPerimeter;fixedSize=1;', class: 'swimlane;fontStyle=1;childLayout=stackLayout;horizontal=1;startSize=26;',
}
const ARROW_OUT: Record<ArrowKind, string> = { none: 'none', arrow: 'open', triangle: 'block', open: 'block;endFill=0', diamond: 'diamond', dot: 'oval', bar: 'dash' }
const ARROW_IN: Record<string, ArrowKind> = { none: 'none', open: 'arrow', classic: 'triangle', block: 'triangle', diamond: 'diamond', diamondThin: 'diamond', oval: 'dot', dash: 'bar', box: 'bar' }

function cellStyle(e: ShapeEl): string {
  const s = e.s
  let st = (KIND_STYLE[e.kind] ?? '') + 'whiteSpace=wrap;html=1;'
  if (e.kind === 'rect' && s.radius > 0) st = `rounded=1;arcSize=${Math.min(50, Math.round((s.radius / Math.min(e.w, e.h)) * 100))};` + st
  else if (e.kind === 'rect') st = 'rounded=0;' + st
  st += `fillColor=${col(s.fill)};strokeColor=${col(s.stroke)};strokeWidth=${s.sw};fontColor=${s.color};fontSize=${s.fs};`
  if (s.dash !== 'solid') st += `dashed=1;${s.dash === 'dotted' ? 'dashPattern=1 3;' : ''}`
  if (s.shadow) st += 'shadow=1;'
  if (s.opacity < 1) st += `opacity=${Math.round(s.opacity * 100)};`
  st += `fontStyle=${(s.bold ? 1 : 0) + (s.italic ? 2 : 0)};align=${s.align};`
  if (s.sketch) st += 'sketch=1;'
  return st
}
function edgeStyle(e: EdgeEl): string {
  const s = e.s
  let st = e.route === 'orth' ? 'edgeStyle=orthogonalEdgeStyle;rounded=1;' : e.route === 'curve' ? 'curved=1;' : 'edgeStyle=none;'
  st += `html=1;strokeColor=${col(s.stroke)};strokeWidth=${s.sw};fontColor=${s.color};fontSize=${s.fs};`
  st += `endArrow=${ARROW_OUT[e.head]};startArrow=${ARROW_OUT[e.tail]};`
  if (s.dash !== 'solid') st += 'dashed=1;'
  return st
}

/** Writes an uncompressed .drawio / diagrams.net file. Freehand strokes have no draw.io equivalent and are skipped. */
export function toDrawio(doc: Doc, title = 'Page-1'): { xml: string; skipped: number } {
  const nodes = nodeMap(doc.els); const cells: string[] = []; let skipped = 0
  for (const e of doc.els) {
    if (e.t === 'shape') cells.push(`<mxCell id="${esc(e.id)}" value="${esc(e.text)}" style="${esc(cellStyle(e))}" vertex="1" parent="1"><mxGeometry x="${Math.round(e.x)}" y="${Math.round(e.y)}" width="${Math.round(e.w)}" height="${Math.round(e.h)}" as="geometry"/></mxCell>`)
    else if (e.t === 'image') cells.push(`<mxCell id="${esc(e.id)}" value="" style="shape=image;imageAspect=0;aspect=fixed;verticalLabelPosition=bottom;verticalAlign=top;image=${esc(e.src.replace(';base64', ''))};" vertex="1" parent="1"><mxGeometry x="${Math.round(e.x)}" y="${Math.round(e.y)}" width="${Math.round(e.w)}" height="${Math.round(e.h)}" as="geometry"/></mxCell>`)
    else if (e.t === 'edge') {
      const g = edgeGeo(e, nodes); const pts: string[] = []
      if (!e.a.id) pts.push(`<mxPoint x="${Math.round(g.a.x)}" y="${Math.round(g.a.y)}" as="sourcePoint"/>`)
      if (!e.b.id) pts.push(`<mxPoint x="${Math.round(g.b.x)}" y="${Math.round(g.b.y)}" as="targetPoint"/>`)
      const src = e.a.id && nodes.has(e.a.id) ? ` source="${esc(e.a.id)}"` : '', tgt = e.b.id && nodes.has(e.b.id) ? ` target="${esc(e.b.id)}"` : ''
      cells.push(`<mxCell id="${esc(e.id)}" value="${esc(e.text)}" style="${esc(edgeStyle(e))}" edge="1" parent="1"${src}${tgt}><mxGeometry relative="1" as="geometry">${pts.join('')}</mxGeometry></mxCell>`)
    } else skipped++
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<mxfile host="DevPocket" version="1.0"><diagram id="${uid()}" name="${esc(title)}"><mxGraphModel grid="${doc.grid ? 1 : 0}" gridSize="${doc.gridSize}" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" pageScale="1" background="${doc.bg}"><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells.join('')}</root></mxGraphModel></diagram></mxfile>\n`
  return { xml, skipped }
}

// ---------- import ----------
async function inflateRaw(b64: string): Promise<string> {
  const bin = atob(b64.trim()); const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  const ds = new DecompressionStream('deflate-raw'); const stream = new Blob([bytes]).stream().pipeThrough(ds)
  const out = await new Response(stream).text()
  try { return decodeURIComponent(out) } catch { return out }
}
const parseStyle = (s: string) => { const o: Record<string, string> = {}; for (const part of s.split(';')) { if (!part) continue; const i = part.indexOf('='); if (i < 0) o[part] = '1'; else o[part.slice(0, i)] = part.slice(i + 1) } return o }
const htmlText = (v: string) => { if (!/[<&]/.test(v)) return v; const d = new DOMParser().parseFromString(v.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(div|p|li)>/gi, '\n'), 'text/html'); return (d.body.textContent ?? '').replace(/\n+$/, '') }
const colour = (v: string | undefined, d: string) => (!v ? d : v === 'none' ? 'none' : /^#[0-9a-f]{3,8}$/i.test(v) ? v : d)
function kindOf(st: Record<string, string>, keys: string[]): ShapeKind {
  const shape = st.shape ?? ''
  if (keys.includes('ellipse') && shape === 'cloud') return 'cloud'
  if (keys.includes('ellipse')) return 'ellipse'
  if (keys.includes('rhombus')) return 'diamond'
  if (keys.includes('triangle')) return 'triangle'
  if (keys.includes('text')) return 'text'
  if (keys.includes('swimlane')) return 'class'
  if (/hexagon/.test(shape)) return 'hexagon'
  if (/parallelogram/.test(shape)) return 'parallelogram'
  if (/trapezoid/.test(shape)) return 'trapezoid'
  if (/cylinder/.test(shape)) return 'cylinder'
  if (shape === 'document') return 'document'
  if (shape === 'process') return 'process'
  if (shape === 'callout') return 'callout'
  if (shape === 'umlActor') return 'actor'
  if (shape === 'folder') return 'package'
  if (shape === 'note') return 'note'
  if (shape === 'step') return 'chevron'
  if (/star/.test(shape)) return 'star'
  return 'rect'
}

export async function fromDrawio(text: string): Promise<{ doc: Doc; notes: string[] }> {
  const notes: string[] = []
  const xml = new DOMParser().parseFromString(text, 'text/xml')
  if (xml.querySelector('parsererror')) throw new Error('Not a valid draw.io / diagrams.net file')
  let model = xml.querySelector('mxGraphModel')
  if (!model) {
    const dg = xml.querySelector('diagram'); const raw = dg?.textContent?.trim()
    if (!raw) throw new Error('This file has no diagram content')
    const inner = await inflateRaw(raw).catch(() => { throw new Error('Could not decompress the diagram (unsupported encoding)') })
    model = new DOMParser().parseFromString(inner, 'text/xml').querySelector('mxGraphModel')
    if (!model) throw new Error('Could not read the diagram')
  }
  const cells = [...model.querySelectorAll('root > mxCell, root > object > mxCell')]
  const geo = new Map<string, { x: number; y: number; parent: string }>()
  const els: El[] = []; const idMap = new Map<string, string>()
  const vertices = cells.filter((c) => c.getAttribute('vertex') === '1')
  for (const c of vertices) { const g = c.querySelector('mxGeometry'); geo.set(c.getAttribute('id') ?? '', { x: +(g?.getAttribute('x') ?? 0), y: +(g?.getAttribute('y') ?? 0), parent: c.getAttribute('parent') ?? '1' }) }
  const abs = (id: string): { x: number; y: number } => { let x = 0, y = 0; let cur = geo.get(id); let guard = 0; while (cur && guard++ < 20) { x += cur.x; y += cur.y; cur = geo.get(cur.parent) } return { x, y } }
  for (const c of vertices) {
    const id = c.getAttribute('id') ?? uid(); const g = c.querySelector('mxGeometry'); if (!g) continue
    const st = parseStyle(c.getAttribute('style') ?? ''); const keys = (c.getAttribute('style') ?? '').split(';').filter((p) => p && !p.includes('='))
    const { x, y } = abs(id); const w = Math.max(10, +(g.getAttribute('width') ?? 100)), h = Math.max(10, +(g.getAttribute('height') ?? 60))
    const base = defaultStyle()
    const s: Partial<Style> = { fill: colour(st.fillColor, base.fill), stroke: colour(st.strokeColor, base.stroke), sw: +(st.strokeWidth ?? 2) || 2, color: colour(st.fontColor, base.color), fs: +(st.fontSize ?? 16) || 16, dash: st.dashed === '1' ? (st.dashPattern?.startsWith('1') ? 'dotted' : 'dashed') : 'solid', shadow: st.shadow === '1', sketch: st.sketch === '1', opacity: st.opacity ? Math.min(1, +st.opacity / 100) : 1, bold: ((+(st.fontStyle ?? 0)) & 1) === 1, italic: ((+(st.fontStyle ?? 0)) & 2) === 2, align: st.align === 'left' || st.align === 'right' ? st.align : 'center' }
    if (st.rounded === '1') s.radius = Math.round(((+(st.arcSize ?? 16)) / 100) * Math.min(w, h))
    if (keys.includes('text')) { s.fill = 'none'; s.stroke = 'none' }
    if (st.shape === 'image' && st.image) {
      const src = st.image.startsWith('data:') ? (st.image.includes(';base64') ? st.image : st.image.replace(/^(data:[^,]+),/, '$1;base64,')) : ''
      if (src) { els.push({ id, t: 'image', x, y, w, h, src, s: defaultStyle() }); idMap.set(c.getAttribute('id') ?? id, id); continue }
      notes.push('Skipped an image that is not embedded'); continue
    }
    const el = newShape(kindOf(st, keys), x, y, w, h, { id, text: htmlText(c.getAttribute('value') ?? ''), s })
    els.push(el); idMap.set(c.getAttribute('id') ?? id, id)
  }
  for (const c of cells.filter((c) => c.getAttribute('edge') === '1')) {
    const st = parseStyle(c.getAttribute('style') ?? ''); const g = c.querySelector('mxGeometry')
    const src = c.getAttribute('source'), tgt = c.getAttribute('target')
    const pt = (as: string) => { const p = g?.querySelector(`mxPoint[as="${as}"]`); return { x: +(p?.getAttribute('x') ?? 0), y: +(p?.getAttribute('y') ?? 0) } }
    const endOf = (ref: string | null, as: string) => (ref && idMap.has(ref) ? { id: idMap.get(ref) } : pt(as))
    const arrow = (k: string | undefined, fill: string | undefined, d: ArrowKind): ArrowKind => { if (!k) return d; if (k === 'block' && fill === '0') return 'open'; return ARROW_IN[k] ?? 'triangle' }
    const route: EdgeEl['route'] = /orthogonal|elbow/i.test(st.edgeStyle ?? '') ? 'orth' : st.curved === '1' ? 'curve' : 'straight'
    els.push(newEdge(endOf(src, 'sourcePoint'), endOf(tgt, 'targetPoint'), { text: htmlText(c.getAttribute('value') ?? ''), route, head: arrow(st.endArrow, st.endFill, 'triangle'), tail: arrow(st.startArrow, st.startFill, 'none'), s: { stroke: colour(st.strokeColor, '#1f2937'), sw: +(st.strokeWidth ?? 2) || 2, color: colour(st.fontColor, '#1f2937'), fs: +(st.fontSize ?? 13) || 13, dash: st.dashed === '1' ? 'dashed' : 'solid' } }))
  }
  if (model.querySelector('mxCell[style*="swimlane"] ~ mxCell[parent]')) notes.push('Container/swimlane contents are imported as separate shapes')
  const d = emptyDoc()
  const bg = model.getAttribute('background'); if (bg && /^#[0-9a-f]{3,8}$/i.test(bg)) d.bg = bg
  d.grid = model.getAttribute('grid') !== '0'; d.gridSize = +(model.getAttribute('gridSize') ?? 20) || 20
  d.els = els
  return { doc: d, notes }
}
