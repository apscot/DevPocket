import { useMemo, useState } from 'react'
import { Empty, Field, Input, Notice, Panel, CopyButton } from '@/components/kit'
import { parseColor, rgbToHsl, toHex, toHslString, toRgbString } from '@/lib/color'

export default function ColorConverter() {
  const [v, setV] = useState('#0f766e')
  const r = useMemo(() => { if (!v.trim()) return null; try { const c = parseColor(v); return { c, err: '' } } catch (e) { return { c: null, err: (e as Error).message } } }, [v])
  const c = r?.c; const h = c ? rgbToHsl(c) : null
  const rows: [string, string][] = c && h ? [['HEX', toHex(c)], ['HEX (lowercase)', toHex(c).toLowerCase()], ['RGB', toRgbString(c)], ['RGB (percent)', `rgb(${Math.round((c.r / 255) * 100)}%, ${Math.round((c.g / 255) * 100)}%, ${Math.round((c.b / 255) * 100)}%)`], ['HSL', toHslString(c)], ['Components', `r=${c.r} g=${c.g} b=${c.b} a=${c.a}`], ['HSL values', `h=${h.h.toFixed(1)}° s=${(h.s * 100).toFixed(1)}% l=${(h.l * 100).toFixed(1)}%`]] : []
  return (
    <div className="flex flex-col gap-3">
      <Panel title="Input"><Field label="HEX (#rgb, #rrggbb, #rrggbbaa), rgb(), hsl() or CSS name"><Input value={v} onChange={(e) => setV(e.target.value)} className="mono max-w-md" aria-label="Color input" /></Field></Panel>
      {r?.err && <Notice kind="error">{r.err}</Notice>}
      {!r && <Empty>Enter a color in any supported format.</Empty>}
      {c && <><div className="h-16 rounded-lg border" style={{ background: toRgbString(c) }} /><Panel title="Converted"><table className="w-full text-sm"><tbody>{rows.map(([l, val]) => <tr key={l} className="border-t"><td className="w-40 py-1.5 text-muted-foreground">{l}</td><td className="mono" data-testid={`cc-${l}`}>{val}</td><td className="w-10 text-right"><CopyButton text={val} size="icon" label={`Copy ${l}`} /></td></tr>)}</tbody></table></Panel></>}
    </div>
  )
}
