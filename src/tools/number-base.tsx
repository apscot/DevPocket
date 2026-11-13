import { useState } from 'react'
import { Field, Input, Notice, Panel, CopyButton } from '@/components/kit'
import { parseBig, toBase } from '@/lib/bignum'

const BASES = [['Decimal', 10], ['Hexadecimal', 16], ['Binary', 2], ['Octal', 8]] as const
export default function NumberBase() {
  const [vals, setVals] = useState<Record<number, string>>({ 10: '', 16: '', 2: '', 8: '' })
  const [err, setErr] = useState('')
  const edit = (base: number, text: string) => {
    if (!text.trim()) { setVals({ 10: '', 16: '', 2: '', 8: '' }); setErr(''); return }
    try {
      const n = parseBig(text, base)
      setVals({ 10: toBase(n, 10), 16: toBase(n, 16).toUpperCase(), 2: toBase(n, 2), 8: toBase(n, 8), [base]: text }); setErr('')
    } catch (e) { setVals({ ...vals, [base]: text }); setErr((e as Error).message) }
  }
  return (
    <div className="flex flex-col gap-3">
      <Notice kind="info">Edit any field — the others update instantly. Arbitrary-size integers are supported with no floating-point precision loss (BigInt).</Notice>
      {err && <Notice kind="error">{err}</Notice>}
      <Panel title="Bases"><div className="grid gap-3">{BASES.map(([label, b]) => (
        <Field key={b} label={`${label} (base ${b})`}><div className="flex gap-2"><Input className="mono" aria-label={label} value={vals[b]} onChange={(e) => edit(b, e.target.value)} /><CopyButton text={vals[b]} size="icon" label={`Copy ${label}`} /></div></Field>))}</div></Panel>
    </div>
  )
}
