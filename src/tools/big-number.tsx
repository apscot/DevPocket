import { useMemo, useState } from 'react'
import { Field, Grid, Input, Notice, Panel, Select, Stat, CopyButton } from '@/components/kit'
import { bitLength, parseBig, toBase, twosComplement } from '@/lib/bignum'

export default function BigNumber() {
  const [v, setV] = useState('')
  const [base, setBase] = useState(10)
  const [custom, setCustom] = useState(36)
  const res = useMemo(() => {
    if (!v.trim()) return null
    try {
      const n = parseBig(v, base)
      return { n, err: '' }
    } catch (e) { return { n: 0n, err: (e as Error).message } }
  }, [v, base])
  const rows: [string, string][] = res && !res.err ? [['Decimal', toBase(res.n, 10)], ['Hexadecimal', toBase(res.n, 16).toUpperCase()], ['Binary', toBase(res.n, 2)], ['Octal', toBase(res.n, 8)], [`Base ${custom}`, toBase(res.n, custom)]] : []
  return (
    <div className="flex flex-col gap-3">
      <Panel title="Input">
        <div className="grid gap-3 sm:grid-cols-[1fr_180px_140px]">
          <Field label="Number" hint="Supports negatives, 0x / 0b / 0o prefixes and _ separators"><Input value={v} onChange={(e) => setV(e.target.value)} placeholder="e.g. 123456789012345678901234567890" aria-label="Number" className="mono" /></Field>
          <Field label="Input base"><Select value={base} onChange={(e) => setBase(Number(e.target.value))}><option value={10}>Decimal (10)</option><option value={16}>Hexadecimal (16)</option><option value={2}>Binary (2)</option><option value={8}>Octal (8)</option></Select></Field>
          <Field label="Custom output base"><Input type="number" min={2} max={36} value={custom} onChange={(e) => setCustom(Math.min(36, Math.max(2, Number(e.target.value) || 2)))} /></Field>
        </div>
      </Panel>
      {res?.err && <Notice kind="error">{res.err}</Notice>}
      {rows.length > 0 && res && (
        <>
          <Grid cols={3}><Stat label="Bit length" value={bitLength(res.n)} /><Stat label="Decimal digits" value={toBase(res.n < 0n ? -res.n : res.n, 10).length} /><Stat label="Exceeds JS safe integer" value={res.n > BigInt(Number.MAX_SAFE_INTEGER) || res.n < -BigInt(Number.MAX_SAFE_INTEGER) ? 'Yes' : 'No'} tone="warn" /></Grid>
          <Panel title="Results"><div className="space-y-2">{rows.map(([l, val]) => (
            <div key={l} className="flex items-start gap-2 rounded-md border p-2"><span className="w-28 shrink-0 text-xs font-medium text-muted-foreground">{l}</span><code className="mono min-w-0 flex-1 break-all" data-testid={`out-${l}`}>{val}</code><CopyButton text={val} size="icon" label={`Copy ${l}`} /></div>))}</div></Panel>
          {res.n < 0n && <Panel title="Two’s complement"><div className="space-y-1 text-sm">{[8, 16, 32, 64].filter((b) => res.n >= -(1n << BigInt(b - 1))).map((b) => <div key={b} className="mono">{b}-bit: 0x{twosComplement(res.n, b).toString(16).toUpperCase().padStart(b / 4, '0')}</div>)}</div></Panel>}
        </>
      )}
    </div>
  )
}
