import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button, Check_, Field, Input, OutputPane, Panel } from '@/components/kit'
import { parseColor } from '@/lib/color'

interface Layer { x: number; y: number; blur: number; spread: number; color: string; opacity: number; inset: boolean }
const rgba = (hex: string, a: number) => { try { const c = parseColor(hex); return `rgba(${c.r}, ${c.g}, ${c.b}, ${a})` } catch { return `rgba(0, 0, 0, ${a})` } }
export default function BoxShadow() {
  const [layers, setLayers] = useState<Layer[]>([{ x: 0, y: 4, blur: 12, spread: 0, color: '#000000', opacity: 0.2, inset: false }, { x: 0, y: 12, blur: 32, spread: -8, color: '#000000', opacity: 0.18, inset: false }])
  const [bg, setBg] = useState('#f4f4f5'); const [box, setBox] = useState('#ffffff'); const [radius, setRadius] = useState(16)
  const set = (i: number, p: Partial<Layer>) => setLayers(layers.map((l, k) => (k === i ? { ...l, ...p } : l)))
  const css = useMemo(() => layers.map((l) => `${l.inset ? 'inset ' : ''}${l.x}px ${l.y}px ${l.blur}px ${l.spread}px ${rgba(l.color, l.opacity)}`).join(',\n    '), [layers])
  const slider = (l: string, v: number, min: number, max: number, on: (n: number) => void) => <Field label={`${l}: ${v}`}><input type="range" aria-label={l} min={min} max={max} step={l === 'Opacity' ? 0.01 : 1} value={v} onChange={(e) => on(Number(e.target.value))} className="accent-[var(--primary)]" /></Field>
  return (
    <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr]">
      <div className="flex flex-col gap-3">
        {layers.map((l, i) => (
          <Panel key={i} title={`Layer ${i + 1}`} actions={layers.length > 1 && <Button variant="ghost" size="icon" aria-label={`Remove layer ${i + 1}`} onClick={() => setLayers(layers.filter((_, k) => k !== i))}><Trash2 size={14} /></Button>}>
            <div className="grid gap-3 sm:grid-cols-2">{slider('X offset', l.x, -100, 100, (n) => set(i, { x: n }))}{slider('Y offset', l.y, -100, 100, (n) => set(i, { y: n }))}{slider('Blur', l.blur, 0, 200, (n) => set(i, { blur: n }))}{slider('Spread', l.spread, -100, 100, (n) => set(i, { spread: n }))}{slider('Opacity', l.opacity, 0, 1, (n) => set(i, { opacity: n }))}
              <Field label="Color"><div className="flex items-center gap-2"><input type="color" aria-label="Shadow color" value={l.color} onChange={(e) => set(i, { color: e.target.value })} className="h-9 w-12 cursor-pointer rounded border bg-card" /><Check_ label="Inset" checked={l.inset} onChange={(v) => set(i, { inset: v })} /></div></Field></div>
          </Panel>))}
        <div><Button onClick={() => setLayers([...layers, { x: 0, y: 2, blur: 6, spread: 0, color: '#000000', opacity: 0.15, inset: false }])}><Plus size={14} />Add layer</Button></div>
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        <Panel title="Preview"><div className="flex h-64 items-center justify-center rounded-md" style={{ background: bg }}><div data-testid="shadow-box" className="h-32 w-48" style={{ background: box, borderRadius: radius, boxShadow: css.replace(/\n\s+/g, ' ') }} /></div>
          <div className="mt-3 grid grid-cols-3 gap-3"><Field label="Backdrop"><input type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="h-9 w-full cursor-pointer rounded border bg-card" aria-label="Backdrop color" /></Field><Field label="Box"><input type="color" value={box} onChange={(e) => setBox(e.target.value)} className="h-9 w-full cursor-pointer rounded border bg-card" aria-label="Box color" /></Field><Field label="Radius"><Input type="number" min={0} value={radius} onChange={(e) => setRadius(Number(e.target.value))} /></Field></div></Panel>
        <OutputPane title="CSS" value={`box-shadow:\n    ${css};`} filename="box-shadow.css" mime="text/css" rows={6} />
      </div>
    </div>
  )
}
