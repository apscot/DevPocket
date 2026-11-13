import { useMemo, useState } from 'react'
import { Pipette } from 'lucide-react'
import { Button, CopyButton, Field, Grid, Input, Notice, Panel } from '@/components/kit'
import { parseColor, rgbToHsl, toHex, toHslString, toRgbString, hslToRgb } from '@/lib/color'
import { useLocal } from '@/hooks/useLocal'

export default function ColorPicker() {
  const [hex, setHex] = useState('#0F766E'); const [recent, setRecent] = useLocal<string[]>('color-recent', [])
  const c = useMemo(() => { try { return parseColor(hex) } catch { return null } }, [hex])
  const hsl = c ? rgbToHsl(c) : null
  const setFrom = (rgb: ReturnType<typeof parseColor>) => setHex(toHex(rgb))
  const vals: [string, string][] = c ? [['HEX', toHex(c)], ['RGB', toRgbString(c)], ['HSL', toHslString(c)], ['CSS var', `--color: ${toHex(c)};`]] : []
  const eye = (window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper
  return (
    <div className="grid gap-3 lg:grid-cols-[320px_1fr]">
      <Panel title="Pick">
        <input type="color" aria-label="Color" value={c ? toHex(c).slice(0, 7) : '#000000'} onChange={(e) => { setHex(e.target.value.toUpperCase()); setRecent([e.target.value.toUpperCase(), ...recent.filter((x) => x !== e.target.value.toUpperCase())].slice(0, 12)) }} className="h-40 w-full cursor-pointer rounded-md border bg-card p-1" data-testid="color-input" />
        <Field label="Value (HEX / rgb() / hsl() / name)" className="mt-3"><Input value={hex} onChange={(e) => setHex(e.target.value)} className="mono" aria-label="Color value" /></Field>
        {eye && <Button className="mt-2" onClick={async () => { try { const r = await new eye().open(); setHex(r.sRGBHex.toUpperCase()) } catch { /* cancelled */ } }}><Pipette size={14} />Pick from screen</Button>}
        {recent.length > 0 && <div className="mt-3"><p className="mb-1 text-xs text-muted-foreground">Recent</p><div className="flex flex-wrap gap-1.5">{recent.map((r) => <button key={r} aria-label={`Use ${r}`} onClick={() => setHex(r)} className="h-7 w-7 cursor-pointer rounded border" style={{ background: r }} />)}</div></div>}
      </Panel>
      <div className="flex min-w-0 flex-col gap-3">
        {!c && <Notice kind="error">Unrecognized color. Use #RRGGBB, rgb(), hsl() or a CSS name.</Notice>}
        {c && hsl && (<>
          <div className="h-24 rounded-lg border" style={{ background: toRgbString(c) }} />
          <Panel title="Values"><div className="space-y-2">{vals.map(([l, v]) => <div key={l} className="flex items-center gap-2"><span className="w-16 text-xs text-muted-foreground">{l}</span><code className="mono min-w-0 flex-1 break-all text-sm" data-testid={`cv-${l}`}>{v}</code><CopyButton text={v} size="icon" label={`Copy ${l}`} /></div>)}</div></Panel>
          <Panel title="Adjust"><Grid cols={3}>{(['Hue', 'Saturation', 'Lightness'] as const).map((l, i) => { const max = i ? 100 : 360; const val = Math.round(i === 0 ? hsl.h : i === 1 ? hsl.s * 100 : hsl.l * 100); return <Field key={l} label={`${l}: ${val}${i ? '%' : '°'}`}><input type="range" min={0} max={max} value={val} aria-label={l} className="accent-[var(--primary)]" onChange={(e) => { const v = Number(e.target.value); setFrom(hslToRgb({ ...hsl, h: i === 0 ? v : hsl.h, s: i === 1 ? v / 100 : hsl.s, l: i === 2 ? v / 100 : hsl.l })) }} /></Field> })}</Grid></Panel></>)}
      </div>
    </div>
  )
}
