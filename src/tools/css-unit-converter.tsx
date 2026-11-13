import { useMemo, useState } from 'react'
import { CopyButton, Field, Grid, Input, Panel, Select } from '@/components/kit'
import { CSS_UNITS, cssToPx, pxToCss, type CssUnit } from '@/lib/datetime'

const FORMULA: Record<CssUnit, string> = { px: 'px = px', rem: 'px = rem × root font size', em: 'px = em × parent font size', pt: 'px = pt × 96 ÷ 72', pc: 'px = pc × 16', in: 'px = in × 96', cm: 'px = cm × 96 ÷ 2.54', mm: 'px = mm × 96 ÷ 25.4', vw: 'px = vw × viewport width ÷ 100', vh: 'px = vh × viewport height ÷ 100', '%': 'px = % × reference size ÷ 100' }
const round = (n: number) => (Number.isFinite(n) ? +n.toFixed(4) : NaN)
export default function CssUnitConverter() {
  const [v, setV] = useState(24); const [u, setU] = useState<CssUnit>('px'); const [root, setRoot] = useState(16); const [parent, setParent] = useState(16); const [vw, setVw] = useState(1440); const [vh, setVh] = useState(900); const [ref, setRef] = useState(800)
  const ctx = { root: root || 16, parent: parent || 16, vw: vw || 1, vh: vh || 1, percentOf: ref || 1 }
  const px = useMemo(() => cssToPx(v, u, ctx), [v, u, root, parent, vw, vh, ref])
  return (
    <div className="flex flex-col gap-3">
      <Panel title="Value"><div className="grid gap-3 sm:grid-cols-[1fr_140px]"><Field label="Value"><Input type="number" step="any" value={v} onChange={(e) => setV(Number(e.target.value))} aria-label="Value" /></Field><Field label="Unit"><Select value={u} onChange={(e) => setU(e.target.value as CssUnit)} aria-label="Unit">{CSS_UNITS.map((x) => <option key={x}>{x}</option>)}</Select></Field></div>
        <Grid cols={4} className="mt-3"><Field label="Root font size (px)"><Input type="number" value={root} onChange={(e) => setRoot(Number(e.target.value))} /></Field><Field label="Parent font size (px, for em)"><Input type="number" value={parent} onChange={(e) => setParent(Number(e.target.value))} /></Field><Field label="Viewport width (px)"><Input type="number" value={vw} onChange={(e) => setVw(Number(e.target.value))} /></Field><Field label="Viewport height (px)"><Input type="number" value={vh} onChange={(e) => setVh(Number(e.target.value))} /></Field></Grid>
        <Field label="Reference size for % (px)" className="mt-3 max-w-xs"><Input type="number" value={ref} onChange={(e) => setRef(Number(e.target.value))} /></Field></Panel>
      <Panel title="Results"><table className="w-full text-sm" data-testid="css-table"><tbody>{CSS_UNITS.map((x) => { const val = `${round(pxToCss(px, x, ctx))}${x}`; return <tr key={x} className="border-t"><td className="mono w-40 py-1.5 font-medium">{val}</td><td className="text-xs text-muted-foreground">{FORMULA[x].replace('px =', x === u ? 'input →' : 'px →')}</td><td className="w-10 text-right"><CopyButton text={val} size="icon" label={`Copy ${val}`} /></td></tr> })}</tbody></table>
        <p className="mt-2 text-xs text-muted-foreground">Formula used: <b>{FORMULA[u]}</b>. Conversion is via px: 1in = 96px = 72pt = 6pc = 2.54cm.</p></Panel>
    </div>
  )
}
