import { useMemo, useState } from 'react'
import { Button, Check_, CopyButton, Field, Grid, Input, Notice, Panel, Stat } from '@/components/kit'
import { SETS, entropyBits, generatePassword, type PwOpts } from '@/lib/security'

export default function PasswordGenerator() {
  const [o, setO] = useState<PwOpts>({ length: 20, lower: true, upper: true, digits: true, symbols: true, excludeAmbiguous: false, exclude: '', custom: '' })
  const [count, setCount] = useState(5); const [nonce, setNonce] = useState(0)
  const res = useMemo(() => {
    void nonce
    try { return { list: Array.from({ length: count }, () => generatePassword(o)), err: '' } } catch (e) { return { list: [] as string[], err: (e as Error).message } }
  }, [o, count, nonce])
  const pool = ((o.lower ? SETS.lower : '') + (o.upper ? SETS.upper : '') + (o.digits ? SETS.digits : '') + (o.symbols ? SETS.symbols : '') + (o.custom ?? '')).length
  const bits = entropyBits(o.length, pool)
  const set = (p: Partial<PwOpts>) => setO({ ...o, ...p })
  return (
    <div className="flex flex-col gap-3">
      <Panel title="Options"><div className="flex flex-wrap items-end gap-x-5 gap-y-3">
        <Field label={`Length: ${o.length}`}><input type="range" min={4} max={128} value={o.length} onChange={(e) => set({ length: Number(e.target.value) })} aria-label="Length" className="w-48 accent-[var(--primary)]" /></Field>
        <Field label="Count"><Input type="number" min={1} max={50} value={count} onChange={(e) => setCount(Math.min(50, Math.max(1, Number(e.target.value) || 1)))} className="w-20" /></Field>
        <Check_ label="a–z" checked={o.lower} onChange={(v) => set({ lower: v })} /><Check_ label="A–Z" checked={o.upper} onChange={(v) => set({ upper: v })} /><Check_ label="0–9" checked={o.digits} onChange={(v) => set({ digits: v })} /><Check_ label="Symbols" checked={o.symbols} onChange={(v) => set({ symbols: v })} />
        <Check_ label="Exclude ambiguous (Il1O0|)" checked={!!o.excludeAmbiguous} onChange={(v) => set({ excludeAmbiguous: v })} />
        <Field label="Exclude characters"><Input value={o.exclude} onChange={(e) => set({ exclude: e.target.value })} className="w-32" /></Field>
        <Field label="Extra characters"><Input value={o.custom} onChange={(e) => set({ custom: e.target.value })} className="w-32" /></Field>
        <Button variant="default" onClick={() => setNonce(nonce + 1)} data-testid="gen-pw">Regenerate</Button>
      </div></Panel>
      {res.err && <Notice kind="error">{res.err}</Notice>}
      {!res.err && <Grid cols={3}><Stat label="Entropy (approx.)" value={`${bits} bits`} tone={bits >= 80 ? 'ok' : bits >= 60 ? 'warn' : 'bad'} /><Stat label="Pool size" value={pool} /><Stat label="Strength" value={bits >= 100 ? 'Excellent' : bits >= 80 ? 'Strong' : bits >= 60 ? 'Fair' : 'Weak'} /></Grid>}
      <Panel title="Passwords" actions={<CopyButton text={res.list.join('\n')} label="Copy all" />}>
        <ul className="space-y-1.5">{res.list.map((p, i) => <li key={i} className="flex items-center gap-2 rounded border px-2 py-1.5"><code className="mono min-w-0 flex-1 break-all" data-testid="pw-item">{p}</code><CopyButton text={p} size="icon" label="Copy password" /></li>)}</ul>
        <p className="mt-2 text-[11px] text-muted-foreground">Generated locally with crypto.getRandomValues using rejection sampling (no modulo bias). Passwords are never stored or transmitted.</p>
      </Panel>
    </div>
  )
}
