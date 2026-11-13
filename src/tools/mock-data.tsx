import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button, Field, Grid, Input, Notice, OutputPane, Panel, Select, Tabs } from '@/components/kit'
import { MOCK_TYPES, generateRecords, type MockField } from '@/lib/mock'
import { stringifyCsv } from '@/lib/csv'

const DEFAULT: MockField[] = [{ name: 'id', type: 'id' }, { name: 'name', type: 'fullName' }, { name: 'email', type: 'email' }, { name: 'age', type: 'integer', min: 18, max: 80 }, { name: 'active', type: 'boolean' }, { name: 'createdAt', type: 'datetime' }]
export default function MockData() {
  const [fields, setFields] = useState<MockField[]>(DEFAULT)
  const [count, setCount] = useState(10)
  const [seedText, setSeed] = useState('')
  const [fmt, setFmt] = useState<'json' | 'ndjson' | 'csv'>('json')
  const [nonce, setNonce] = useState(0)
  const set = (i: number, p: Partial<MockField>) => setFields(fields.map((f, k) => (k === i ? { ...f, ...p } : f)))
  const res = useMemo(() => {
    void nonce
    try {
      const n = Math.min(Math.max(1, count), 10000)
      const recs = generateRecords(fields, n, seedText.trim() === '' ? undefined : Number(seedText))
      const names = fields.filter((f) => f.name.trim()).map((f) => f.name.trim())
      if (!names.length) return { out: '', err: 'Add at least one named field.' }
      const out = fmt === 'json' ? JSON.stringify(recs, null, 2) : fmt === 'ndjson' ? recs.map((r) => JSON.stringify(r)).join('\n') : stringifyCsv([names, ...recs.map((r) => names.map((k) => r[k]))])
      return { out, err: '' }
    } catch (e) { return { out: '', err: (e as Error).message } }
  }, [fields, count, seedText, fmt, nonce])
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(320px,1fr)_1fr]">
      <Panel title="Fields" actions={<Button onClick={() => setFields([...fields, { name: `field${fields.length + 1}`, type: 'word' }])}><Plus size={14} />Add field</Button>}>
        <div className="space-y-2">
          {fields.map((f, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2 rounded-md border p-2">
              <Field label="Name" className="w-32"><Input value={f.name} onChange={(e) => set(i, { name: e.target.value })} aria-label={`Field ${i + 1} name`} /></Field>
              <Field label="Type" className="w-44"><Select value={f.type} onChange={(e) => set(i, { type: e.target.value })} aria-label={`Field ${i + 1} type`}>{MOCK_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
              {['integer', 'float', 'id'].includes(f.type) && <><Field label="Min" className="w-20"><Input type="number" value={f.min ?? 0} onChange={(e) => set(i, { min: Number(e.target.value) })} /></Field>{f.type !== 'id' && <Field label="Max" className="w-20"><Input type="number" value={f.max ?? 1000} onChange={(e) => set(i, { max: Number(e.target.value) })} /></Field>}</>}
              {f.type === 'enum' && <Field label="Options" className="w-40"><Input value={f.options ?? ''} placeholder="a, b, c" onChange={(e) => set(i, { options: e.target.value })} /></Field>}
              <Button variant="ghost" size="icon" aria-label="Remove field" onClick={() => setFields(fields.filter((_, k) => k !== i))}><Trash2 size={14} /></Button>
            </div>))}
        </div>
        <Grid cols={3} className="mt-3">
          <Field label="Records (max 10,000)"><Input type="number" min={1} max={10000} value={count} onChange={(e) => setCount(Number(e.target.value))} /></Field>
          <Field label="Seed (optional)" hint="Same seed → same data"><Input value={seedText} onChange={(e) => setSeed(e.target.value)} placeholder="random" /></Field>
          <div className="flex items-end"><Button onClick={() => setNonce(nonce + 1)}>Regenerate</Button></div>
        </Grid>
      </Panel>
      <div className="flex min-w-0 flex-col gap-3">
        <Tabs value={fmt} onChange={setFmt} items={[['json', 'JSON'], ['ndjson', 'NDJSON'], ['csv', 'CSV']]} />
        {res.err && <Notice kind="error">{res.err}</Notice>}
        <OutputPane value={res.out} filename={`mock.${fmt === 'csv' ? 'csv' : fmt === 'json' ? 'json' : 'ndjson'}`} mime={fmt === 'csv' ? 'text/csv' : 'application/json'} rows={22} />
      </div>
    </div>
  )
}
