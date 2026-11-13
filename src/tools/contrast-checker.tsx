import { useMemo, useState } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { Button, CopyButton, Field, Grid, Input, Notice, Panel, Stat } from '@/components/kit'
import { contrastRatio, parseColor, suggestForeground, toHex, wcag } from '@/lib/color'
import { cn } from '@/lib/cn'

const Badge = ({ ok, label }: { ok: boolean; label: string }) => <div className={cn('rounded-md border px-3 py-2 text-sm', ok ? 'border-success/40 bg-success/5 text-success' : 'border-destructive/40 bg-destructive/5 text-destructive')} data-pass={ok}><b>{ok ? 'Pass' : 'Fail'}</b> <span className="text-foreground">{label}</span></div>
export default function ContrastChecker() {
  const [fg, setFg] = useState('#767676'); const [bg, setBg] = useState('#FFFFFF')
  const r = useMemo(() => { try { const f = parseColor(fg), b = parseColor(bg); const ratio = contrastRatio(f, b); return { f, b, ratio, w: wcag(ratio), sug: ratio < 4.5 ? suggestForeground(f, b) : null, err: '' } } catch (e) { return { err: (e as Error).message } as never } }, [fg, bg])
  const pick = (v: string, set: (s: string) => void, label: string) => <Field label={label}><div className="flex gap-2"><input type="color" aria-label={`${label} picker`} value={(() => { try { return toHex(parseColor(v)).slice(0, 7) } catch { return '#000000' } })()} onChange={(e) => set(e.target.value.toUpperCase())} className="h-9 w-12 cursor-pointer rounded border bg-card" /><Input value={v} onChange={(e) => set(e.target.value)} className="mono" aria-label={`${label} value`} /></div></Field>
  return (
    <div className="flex flex-col gap-3">
      <Panel title="Colors" actions={<Button onClick={() => { setFg(bg); setBg(fg) }}><ArrowLeftRight size={14} />Swap</Button>}><div className="grid gap-3 sm:grid-cols-2">{pick(fg, setFg, 'Foreground (text)')}{pick(bg, setBg, 'Background')}</div></Panel>
      {r.err ? <Notice kind="error">{r.err}</Notice> : (<>
        <Grid cols={3}><Stat label="Contrast ratio" value={<span data-testid="ratio">{r.ratio.toFixed(2)}:1</span>} tone={r.w.aaNormal ? 'ok' : 'bad'} /><Stat label="WCAG AA" value={r.w.aaNormal ? 'Pass' : r.w.aaLarge ? 'Large text only' : 'Fail'} tone={r.w.aaNormal ? 'ok' : r.w.aaLarge ? 'warn' : 'bad'} /><Stat label="WCAG AAA" value={r.w.aaaNormal ? 'Pass' : r.w.aaaLarge ? 'Large text only' : 'Fail'} tone={r.w.aaaNormal ? 'ok' : r.w.aaaLarge ? 'warn' : 'bad'} /></Grid>
        <Panel title="Preview"><div className="rounded-md border p-6" style={{ background: toHex(r.b), color: toHex(r.f) }}><p className="text-3xl font-bold">Large text sample (24px bold)</p><p className="mt-2 text-base">Normal text sample — The quick brown fox jumps over the lazy dog.</p><p className="mt-2 text-sm">Small text 14px</p></div></Panel>
        <Panel title="Requirements"><div className="grid gap-2 sm:grid-cols-2"><Badge ok={r.w.aaNormal} label="AA · normal text (4.5:1)" /><Badge ok={r.w.aaLarge} label="AA · large text (3:1)" /><Badge ok={r.w.aaaNormal} label="AAA · normal text (7:1)" /><Badge ok={r.w.aaaLarge} label="AAA · large text (4.5:1)" /><Badge ok={r.w.ui} label="UI components & graphics (3:1)" /></div>
          <p className="mt-2 text-[11px] text-muted-foreground">Large text = 18pt (24px) or 14pt (18.66px) bold. Ratios use WCAG 2.x relative luminance.</p></Panel>
        {r.sug && <Notice kind="info">Closest passing AA foreground: <b className="mono">{toHex(r.sug)}</b> ({contrastRatio(r.sug, r.b).toFixed(2)}:1) <CopyButton text={toHex(r.sug)} size="icon" label="Copy suggestion" /> <button className="ml-2 cursor-pointer underline" onClick={() => setFg(toHex(r.sug!))}>Use it</button></Notice>}</>)}
    </div>
  )
}
