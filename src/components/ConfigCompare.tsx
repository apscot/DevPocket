import { useMemo, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Button, Check_, CopyButton, DownloadButton, Empty, FileButton, Grid, Hl, Notice, Panel, SearchBox, Select, Stat, Textarea } from './kit'
import { compareFlat, compareToCsv, compareToMarkdown, countStatus, isSensitiveKey, maskValue, type CompareRow, type Flat, type Status } from '@/lib/config'
import { cn } from '@/lib/cn'

const tone: Record<Status, string> = { added: 'bg-success/10 text-success', removed: 'bg-destructive/10 text-destructive', modified: 'bg-warning/10 text-warning', unchanged: 'bg-muted text-muted-foreground' }
const FILTERS: (Status | 'all')[] = ['all', 'added', 'removed', 'modified', 'unchanged']

export function ConfigCompare({ parse, sampleA, sampleB, labelA = 'Left (base)', labelB = 'Right (target)', formats, relaxedOption, accept }: {
  parse: (text: string, fmt: string, filename: string) => Flat; sampleA: string; sampleB: string; labelA?: string; labelB?: string
  formats?: [string, string][]; relaxedOption?: boolean; accept?: string
}) {
  const [a, setA] = useState(''); const [b, setB] = useState('')
  const [fa, setFa] = useState('auto'); const [fb, setFb] = useState('auto')
  const [na, setNa] = useState(''); const [nb, setNb] = useState('')
  const [mask, setMask] = useState(true); const [reveal, setReveal] = useState<Set<string>>(new Set())
  const [relaxed, setRelaxed] = useState(false); const [ic, setIc] = useState(false); const [trim, setTrim] = useState(true)
  const [q, setQ] = useState(''); const [filter, setFilter] = useState<Status | 'all'>('all')
  const res = useMemo(() => {
    if (!a.trim() && !b.trim()) return null
    try { return { rows: compareFlat(parse(a, fa, na), parse(b, fb, nb), { relaxed, ignoreValueCase: ic, trimValues: trim }), err: '' } } catch (e) { return { rows: [] as CompareRow[], err: (e as Error).message } }
  }, [a, b, fa, fb, na, nb, relaxed, ic, trim, parse])
  const rows = res?.rows ?? []
  const c = countStatus(rows)
  const list = rows.filter((r) => (filter === 'all' || r.status === filter) && (!q || (r.key + (r.left ?? '') + (r.right ?? '')).toLowerCase().includes(q.toLowerCase())))
  const sensitiveCount = rows.filter((r) => isSensitiveKey(r.key)).length
  const val = (r: CompareRow, v?: string) => (v === undefined ? null : mask && isSensitiveKey(r.key) && !reveal.has(r.key) ? maskValue(v) : v)
  const raw = (r: CompareRow, v?: string) => v ?? ''
  const exportJson = JSON.stringify(list.map((r) => ({ key: r.key, status: r.status, left: mask && isSensitiveKey(r.key) ? (r.left === undefined ? undefined : maskValue(r.left)) : r.left, right: mask && isSensitiveKey(r.key) ? (r.right === undefined ? undefined : maskValue(r.right)) : r.right })), null, 2)
  const pane = (label: string, text: string, set: (v: string) => void, fmt: string, setFmt: (v: string) => void, setName: (v: string) => void, sample: string) => (
    <Panel title={label} actions={<>
      {formats && <Select aria-label={`${label} format`} value={fmt} onChange={(e) => setFmt(e.target.value)} className="h-8 w-40">{formats.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>}
      <Button onClick={() => { set(sample); setName('') }}>Sample</Button>
      <FileButton accept={accept} onText={(t, n) => { set(t); setName(n) }} /></>}>
      <Textarea aria-label={label} value={text} onChange={(e) => set(e.target.value)} rows={12} className="w-full" placeholder="Paste or upload…" />
    </Panel>)
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 lg:grid-cols-2">{pane(labelA, a, setA, fa, setFa, setNa, sampleA)}{pane(labelB, b, setB, fb, setFb, setNb, sampleB)}</div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Check_ label="Mask sensitive values" checked={mask} onChange={(v) => { setMask(v); setReveal(new Set()) }} />
        {relaxedOption && <Check_ label="Relaxed key binding (my-key = myKey = my_key)" checked={relaxed} onChange={setRelaxed} />}
        <Check_ label="Ignore value case" checked={ic} onChange={setIc} /><Check_ label="Trim values" checked={trim} onChange={setTrim} />
      </div>
      {res?.err && <Notice kind="error">{res.err}</Notice>}
      {!res ? <Empty>Paste or upload two files to compare them.</Empty> : !res.err && (
        <>
          <Grid cols={4}><Stat label="Added" value={c.added} tone="ok" /><Stat label="Removed" value={c.removed} tone="bad" /><Stat label="Modified" value={c.modified} tone="warn" /><Stat label="Unchanged" value={c.unchanged} /></Grid>
          {mask && sensitiveCount > 0 && <Notice kind="info">{sensitiveCount} sensitive-looking key{sensitiveCount > 1 ? 's are' : ' is'} masked (password, secret, token, credential, API key…). Use the eye icon to reveal one. Exports keep masking on.</Notice>}
          <Panel title={`Comparison (${list.length} of ${rows.length})`} actions={<>
            <SearchBox value={q} onChange={setQ} placeholder="Search keys / values" className="w-48" />
            <CopyButton text={exportJson} label="Copy JSON" /><DownloadButton text={exportJson} filename="comparison.json" mime="application/json" label="JSON" /><DownloadButton text={compareToCsv(list, mask)} filename="comparison.csv" mime="text/csv" label="CSV" /><DownloadButton text={compareToMarkdown(list, mask)} filename="comparison.md" mime="text/markdown" label="MD" /></>}>
            <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Filter by difference type">
              {FILTERS.map((f) => <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f} data-testid={`filter-${f}`} className={cn('cursor-pointer rounded-full border px-3 py-1 text-xs capitalize', filter === f ? 'border-primary bg-accent text-primary' : 'text-muted-foreground hover:bg-muted')}>{f}{f !== 'all' && ` (${c[f]})`}</button>)}
            </div>
            <div className="scroll-thin max-h-[520px] overflow-auto rounded-md border" data-testid="compare-table">
              <table className="w-full table-fixed text-sm">
                <thead className="sticky top-0 z-10 bg-muted text-left text-xs text-muted-foreground"><tr><th className="w-[30%] p-2">Key</th><th className="w-[84px]">Status</th><th className="w-[33%]">{labelA}</th><th>{labelB}</th></tr></thead>
                <tbody>{list.map((r) => {
                  const sens = isSensitiveKey(r.key)
                  return (
                    <tr key={r.key} className="border-t align-top" data-status={r.status}>
                      <td className="mono break-all p-2"><Hl text={r.key} q={q} />{mask && sens && <button aria-label={reveal.has(r.key) ? 'Hide value' : 'Reveal value'} className="ml-1 cursor-pointer align-middle text-muted-foreground hover:text-foreground" onClick={() => setReveal((s) => { const n = new Set(s); if (n.has(r.key)) n.delete(r.key); else n.add(r.key); return n })}>{reveal.has(r.key) ? <EyeOff size={13} /> : <Eye size={13} />}</button>}</td>
                      <td className="p-1"><span className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium', tone[r.status])}>{r.status}</span></td>
                      {([r.left, r.right] as (string | undefined)[]).map((v, i) => (
                        <td key={i} className={cn('mono group break-all p-2', v === undefined && 'text-muted-foreground/50', r.status === 'modified' && (i ? 'bg-success/5' : 'bg-destructive/5'))}>
                          {v === undefined ? '—' : <><Hl text={val(r, v) ?? ''} q={mask && sens && !reveal.has(r.key) ? '' : q} /><span className="ml-1 inline-block opacity-0 group-hover:opacity-100 focus-within:opacity-100"><CopyButton text={raw(r, v)} size="icon" label={`Copy value of ${r.key}`} className="h-5 w-5 align-middle" /></span></>}
                        </td>))}
                    </tr>)
                })}</tbody>
              </table>
              {!list.length && <p className="p-6 text-center text-sm text-muted-foreground">No entries match the current filter.</p>}
            </div>
          </Panel>
        </>
      )}
    </div>
  )
}
