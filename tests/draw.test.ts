import { describe, expect, it } from 'vitest'
import { alignDeltas, anchor, arrowHead, distributeDeltas, edgeGeo, facingSides, hitEl, nodeMap, orthPoints, resizeRect, roughPath, snapRect, strokeOutline } from '../src/lib/draw/geom'
import { cloneEls, expandGroups, groupEls, newEdge, newShape, parseDoc, removeEls, reorder, serializeDoc } from '../src/lib/draw/scene'
import { autoLayout, graphToEls, layeredLayout, parseMermaidFlowchart, TEMPLATES } from '../src/lib/draw/layout'
import { fromDrawio, toDrawio } from '../src/lib/draw/drawio'
import { shapeGeom } from '../src/lib/draw/shapes'
import { wrap } from '../src/lib/draw/text'
import { emptyDoc, type El } from '../src/lib/draw/types'

const A = newShape('rect', 0, 0, 100, 60, { id: 'a', text: 'A' })
const B = newShape('rect', 300, 0, 100, 60, { id: 'b', text: 'B' })
const near = (n: number, m: number) => expect(n).toBeCloseTo(m, 3)

describe('connectors', () => {
  it('routes orthogonally between facing sides with a draggable bend', () => {
    const e = newEdge({ id: 'a', side: 'r' }, { id: 'b', side: 'l' }, { route: 'orth', bend: 0.25 })
    const g = edgeGeo(e, nodeMap([A, B]))
    expect(g.a).toEqual({ x: 100, y: 30 }); expect(g.b).toEqual({ x: 300, y: 30 })
    expect(g.pts).toHaveLength(2) // straight run: no needless bends
    const B2 = { ...B, y: 100 }; const g2 = edgeGeo(e, nodeMap([A, B2]))
    expect(g2.pts).toHaveLength(4); near(g2.bendHandle!.p.x, 150); expect(g2.bendHandle!.axis).toBe('x')
    for (let i = 1; i < g2.pts.length; i++) expect(g2.pts[i].x === g2.pts[i - 1].x || g2.pts[i].y === g2.pts[i - 1].y).toBe(true)
  })
  it('auto sides pick the facing sides and straight edges stop at the border', () => {
    expect(facingSides({ x: 0, y: 0, w: 100, h: 60 }, { x: 300, y: 10, w: 100, h: 60 })).toEqual(['r', 'l'])
    expect(facingSides({ x: 0, y: 0, w: 100, h: 60 }, { x: 10, y: 300, w: 100, h: 60 })).toEqual(['b', 't'])
    const g = edgeGeo(newEdge({ id: 'a' }, { id: 'b' }, { route: 'straight' }), nodeMap([A, B]))
    near(g.a.x, 100); near(g.b.x, 300)
  })
  it('keeps every orthogonal case axis-aligned, including U-turns', () => {
    const cases: [string, string][] = [['r', 'r'], ['l', 'l'], ['t', 't'], ['b', 'b'], ['r', 'l'], ['r', 't'], ['b', 'l'], ['t', 'r'], ['l', 'b']]
    for (const [sa, sb] of cases) for (const B of [{ x: 200, y: 150 }, { x: -120, y: -90 }, { x: 5, y: 5 }]) {
      const { pts } = orthPoints({ x: 0, y: 0 }, sa as 't', B, sb as 't', 0.5)
      for (let i = 1; i < pts.length; i++) expect(Math.abs(pts[i].x - pts[i - 1].x) < 0.01 || Math.abs(pts[i].y - pts[i - 1].y) < 0.01, `${sa}${sb} ${JSON.stringify(B)}`).toBe(true)
    }
  })
  it('detaches edges to free points when a node is deleted', () => {
    const e = newEdge({ id: 'a', side: 'r' }, { id: 'b', side: 'l' }, { id: 'e' })
    const out = removeEls([A, B, e], ['b']); const ed = out.find((x) => x.id === 'e') as typeof e
    expect(out.map((x) => x.id)).toEqual(['a', 'e']); expect(ed.b).toEqual({ x: 300, y: 30 }); expect(ed.a.id).toBe('a')
  })
  it('draws arrowheads for every kind', () => {
    for (const k of ['arrow', 'triangle', 'open', 'diamond', 'dot', 'bar'] as const) expect(arrowHead(k, { x: 0, y: 0 }, { x: 1, y: 0 }, 10)?.d).toMatch(/^M/)
    expect(arrowHead('none', { x: 0, y: 0 }, { x: 1, y: 0 }, 10)).toBeNull()
  })
  it('hit-tests edges and labels', () => {
    const e = newEdge({ id: 'a', side: 'r' }, { id: 'b', side: 'l' }, { text: 'hello' }); const m = nodeMap([A, B])
    expect(hitEl(e, { x: 200, y: 31 }, 4, m)).toBe(true); expect(hitEl(e, { x: 200, y: 80 }, 4, m)).toBe(false)
  })
})

describe('geometry helpers', () => {
  it('snaps to neighbours and grid, producing guides', () => {
    const r = snapRect({ x: 103, y: 52, w: 50, h: 50 }, [{ x: 100, y: 0, w: 80, h: 40 }], 6, 20)
    expect(r.dx).toBe(-3); expect(r.guides.some((g) => g.x1 === 100)).toBe(true)
    const g = snapRect({ x: 33, y: 47, w: 10, h: 10 }, [], 6, 20); expect([g.dx, g.dy]).toEqual([7, -7])
  })
  it('resizes from handles, keeps aspect and a minimum size', () => {
    expect(resizeRect({ x: 0, y: 0, w: 100, h: 50 }, 'se', 20, 10, false)).toEqual({ x: 0, y: 0, w: 120, h: 60 })
    expect(resizeRect({ x: 0, y: 0, w: 100, h: 50 }, 'nw', 20, 10, false)).toEqual({ x: 20, y: 10, w: 80, h: 40 })
    const k = resizeRect({ x: 0, y: 0, w: 100, h: 50 }, 'se', 100, 0, true); near(k.w / k.h, 2)
    expect(resizeRect({ x: 0, y: 0, w: 100, h: 50 }, 'e', -500, 0, false).w).toBe(12)
  })
  it('aligns and distributes', () => {
    const rs = [{ x: 0, y: 0, w: 10, h: 10 }, { x: 50, y: 20, w: 30, h: 10 }, { x: 200, y: 5, w: 10, h: 10 }]
    expect(alignDeltas(rs, 'left').map((d) => d.x)).toEqual([0, -50, -200])
    expect(alignDeltas(rs, 'middle').map((d) => d.y)).toEqual([10, -10, 5].map((v) => v)) // centre of union is y=15
    const d = distributeDeltas(rs, 'h'); near(rs[1].x + d[1].x, 90)
  })
  it('builds ink outlines and hand-drawn paths deterministically', () => {
    expect(strokeOutline([0, 0, 0.5, 10, 0, 0.5, 20, 5, 0.5, 30, 5, 0.5], 4)).toMatch(/^M.*Z$/)
    expect(strokeOutline([5, 5, 0.5], 6)).toMatch(/a3 3/)
    const poly = shapeGeom('rect', 100, 50).poly
    expect(roughPath(poly, true, 7)).toBe(roughPath(poly, true, 7)); expect(roughPath(poly, true, 7)).not.toBe(roughPath(poly, true, 8))
  })
  it('wraps text on words and breaks long words', () => {
    const st = { fs: 16, font: 'sans' as const, bold: false, italic: false }
    expect(wrap('one two three four five six', 90, st).length).toBeGreaterThan(1)
    expect(wrap('a\n\nb', 500, st)).toEqual(['a', '', 'b'])
    for (const l of wrap('supercalifragilisticexpialidocious', 60, st)) expect(l.length).toBeLessThan(34)
  })
  it('shape geometry exists for every kind', () => {
    for (const k of ['rect', 'ellipse', 'diamond', 'triangle', 'hexagon', 'parallelogram', 'trapezoid', 'cylinder', 'cloud', 'document', 'process', 'callout', 'star', 'actor', 'class', 'package', 'note', 'text', 'icon', 'chevron'] as const) {
      const g = shapeGeom(k, 120, 80); expect(g.poly.length).toBeGreaterThanOrEqual(3); expect(g.text.w).toBeGreaterThan(0)
      if (g.prim === 'path') expect(g.d).not.toMatch(/NaN/)
    }
    expect(anchor(A, 'b')).toEqual({ x: 50, y: 60 })
  })
})

describe('scene operations', () => {
  it('clones with remapped connections and groups', () => {
    const e = newEdge({ id: 'a', side: 'r' }, { id: 'b', side: 'l' }, { id: 'e' })
    const els: El[] = groupEls([A, B, e], ['a', 'b'])
    const c = cloneEls(els, ['a', 'b', 'e'], 10, 10) as [typeof A, typeof B, typeof e]
    expect(new Set(c.map((x) => x.id)).size).toBe(3); expect(c[2].a.id).toBe(c[0].id); expect(c[2].b.id).toBe(c[1].id); expect(c[0].g).toBe(c[1].g); expect(c[0].g).not.toBe(els[0].g); expect(c[0].x).toBe(10)
    const lonely = cloneEls(els, ['e'], 5, 5)[0] as typeof e; expect(lonely.a.id).toBeUndefined(); expect(lonely.a.x).toBe(105)
  })
  it('expands groups and reorders', () => {
    const els = groupEls([A, B, newShape('rect', 0, 0, 5, 5, { id: 'c' })], ['a', 'b'])
    expect(expandGroups(els, ['a']).sort()).toEqual(['a', 'b'])
    expect(reorder(els, ['a'], 'front').map((x) => x.id)).toEqual(['b', 'c', 'a'])
    expect(reorder(els, ['c'], 'back').map((x) => x.id)).toEqual(['c', 'a', 'b'])
    expect(reorder(els, ['a'], 'forward').map((x) => x.id)).toEqual(['b', 'a', 'c'])
    expect(reorder(els, ['c'], 'backward').map((x) => x.id)).toEqual(['a', 'c', 'b'])
  })
  it('round-trips files and rejects hostile input', () => {
    const doc = { ...emptyDoc(), bg: '#112233', els: [A, B, newEdge({ id: 'a' }, { id: 'b' })] as El[] }
    const back = parseDoc(serializeDoc(doc)); expect(back.els).toHaveLength(3); expect(back.bg).toBe('#112233')
    expect(() => parseDoc('{"x":1}')).toThrow(); expect(() => parseDoc('nope')).toThrow()
    const evil = parseDoc(JSON.stringify({ bg: 'url(javascript:alert(1))', els: [{ t: 'image', src: 'javascript:alert(1)', x: 0, y: 0, w: 5, h: 5 }, { t: 'image', src: 'data:image/png;base64,AAAA', x: 0, y: 0, w: 5, h: 5 }, { t: 'shape', kind: 'nope' }, { t: 'shape', kind: 'rect', x: 'x', w: -5, s: { fs: 9999, opacity: 7 } }] }))
    expect(evil.bg).toBe('#ffffff'); expect(evil.els.map((e) => e.t)).toEqual(['image', 'shape']); const sh = evil.els[1] as typeof A
    expect(sh.s.fs).toBe(200); expect(sh.s.opacity).toBe(1); expect(sh.w).toBe(4)
  })
})

describe('mermaid import and layout', () => {
  const src = 'flowchart LR\n  A([Start]) --> B{Is valid?}\n  B -- yes --> C[Process]\n  B -->|no| D[(Database)]\n  C -.-> D\n  D ==> E((End))'
  it('parses shapes, labels and edge styles', () => {
    const g = parseMermaidFlowchart(src)
    expect(g.dir).toBe('LR'); expect(g.nodes.map((n) => [n.id, n.kind])).toEqual([['A', 'rect'], ['B', 'diamond'], ['C', 'rect'], ['D', 'cylinder'], ['E', 'ellipse']])
    expect(g.edges.map((e) => e.text ?? '')).toEqual(['', 'yes', 'no', '', '']); expect(g.edges[3].dashed).toBe(true); expect(g.edges[4].thick).toBe(true)
    expect(parseMermaidFlowchart('graph TD\n A-->B-->C').edges).toHaveLength(2)
    const one = parseMermaidFlowchart('graph LR; A[Go] --> B[Done]; B --> C'); expect(one.nodes).toHaveLength(3); expect(one.edges).toHaveLength(2); expect(one.nodes[0].text).toBe('Go')
    expect(() => parseMermaidFlowchart('sequenceDiagram\n A->>B: hi')).toThrow(/flowchart/)
  })
  it('lays out layers left to right without overlaps', () => {
    const g = parseMermaidFlowchart(src); const pos = layeredLayout(g)
    expect(pos.get('A')!.x).toBeLessThan(pos.get('B')!.x); expect(pos.get('B')!.x).toBeLessThan(pos.get('C')!.x)
    const all = [...pos.values()]
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) { const a = all[i], b = all[j]; expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h, `${i}/${j}`).toBe(false) }
  })
  it('survives cycles and builds connected elements; auto-layout keeps edges attached', () => {
    const els = graphToEls(parseMermaidFlowchart('flowchart TD\n A-->B\n B-->C\n C-->A'))
    expect(els.filter((e) => e.t === 'shape')).toHaveLength(3); expect(els.filter((e) => e.t === 'edge')).toHaveLength(3)
    const moved = autoLayout(els.map((e) => (e.t === 'shape' ? { ...e, x: 0, y: 0 } : e)), null, 'LR')
    const xs = moved.filter((e) => e.t === 'shape').map((e) => (e as typeof A).x); expect(new Set(xs).size).toBeGreaterThan(1)
  })
  it('templates build valid diagrams', () => { for (const t of TEMPLATES) { const els = t.build(); expect(els.length).toBeGreaterThan(4); expect(parseDoc(serializeDoc({ ...emptyDoc(), els })).els).toHaveLength(els.length) } })
})

describe('draw.io interchange', () => {
  it('exports and re-imports shapes, text and connections', async () => {
    const els = TEMPLATES[0].build(); const { xml } = toDrawio({ ...emptyDoc(), els })
    expect(xml).toContain('<mxfile'); expect(xml).toContain('rhombus'); expect(xml).toContain('edgeStyle=orthogonalEdgeStyle')
    const { doc } = await fromDrawio(xml)
    expect(doc.els.filter((e) => e.t === 'shape')).toHaveLength(els.filter((e) => e.t === 'shape').length)
    const edges = doc.els.filter((e) => e.t === 'edge') as ReturnType<typeof newEdge>[]
    expect(edges).toHaveLength(els.filter((e) => e.t === 'edge').length); expect(edges.every((e) => e.a.id && e.b.id)).toBe(true)
    expect((doc.els.find((e) => e.t === 'shape' && e.text === 'Valid?') as typeof A).kind).toBe('diamond')
  })
  it('reads plain draw.io XML with HTML labels and nested parents', async () => {
    const xml = `<mxfile><diagram><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
      <mxCell id="c" value="" style="swimlane;" vertex="1" parent="1"><mxGeometry x="100" y="50" width="200" height="200" as="geometry"/></mxCell>
      <mxCell id="n" value="Hello&lt;br&gt;&lt;b&gt;World&lt;/b&gt;" style="ellipse;fillColor=#ff0000;dashed=1;" vertex="1" parent="c"><mxGeometry x="10" y="20" width="80" height="40" as="geometry"/></mxCell>
      <mxCell id="e" style="endArrow=classic;" edge="1" parent="1" source="c" target="n"><mxGeometry relative="1" as="geometry"/></mxCell></root></mxGraphModel></diagram></mxfile>`
    const { doc } = await fromDrawio(xml); const n = doc.els.find((e) => e.t === 'shape' && e.kind === 'ellipse') as typeof A
    expect(n.x).toBe(110); expect(n.y).toBe(70); expect(n.text).toBe('Hello\nWorld'); expect(n.s.fill).toBe('#ff0000'); expect(n.s.dash).toBe('dashed')
    await expect(fromDrawio('<not xml')).rejects.toThrow(); await expect(fromDrawio('<mxfile></mxfile>')).rejects.toThrow()
  })
})

describe('rendering', () => {
  it('exports a self-contained SVG with shapes, text, connectors and ink', async () => {
    const { sceneToSvg } = await import('../src/components/draw/export')
    const els = [...TEMPLATES[0].build(), { id: 'p', t: 'stroke', pts: [0, 0, 0.5, 20, 10, 0.5, 40, 5, 0.5], s: { ...newShape('rect', 0, 0, 1, 1).s, stroke: '#ff0000', sw: 4 } } as El]
    const { svg, w, h } = await sceneToSvg(els, '#ffffff')
    expect(svg).toMatch(/^<\?xml/); expect(svg).toContain('viewBox='); expect(svg).toContain('Receive request'); expect(svg).toContain('<path'); expect(svg).not.toMatch(/NaN|undefined/)
    expect(svg).toContain('fill="#ffffff"'); expect(w).toBeGreaterThan(100); expect(h).toBeGreaterThan(100)
    const t = await sceneToSvg(els, '#abcdef', { transparent: true }), o = await sceneToSvg(els, '#abcdef')
    expect(t.svg).not.toContain(`width="${t.w}" height="${t.h}" fill="#abcdef"`); expect(o.svg).toContain(`width="${o.w}" height="${o.h}" fill="#abcdef"`)
    const sk = (await sceneToSvg([newShape('ellipse', 0, 0, 100, 60, { s: { sketch: true }, text: 'x' })], '#fff')).svg; expect(sk).toContain('<path')
  })
})
