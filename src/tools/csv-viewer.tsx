import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { Empty, FileButton, Notice, Panel, SearchBox, Select, Check_, Stat, Grid, Textarea, Button, useDebounced, CopyButton, DownloadButton } from '@/components/kit'
import { stringifyCsv } from '@/lib/csv'
import { SAMPLE_CSV } from '@/lib/samples'
import { cn } from '@/lib/cn'

const ROW = 32
export default function CsvViewer() {
  const [text, setText] = useState('')
  const [delimiter, setDelimiter] = useState('auto')
  const [header, setHeader] = useState(true)
  const [rows, setRows] = useState<string[][]>([])
  const [used, setUsed] = useState(',')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState(''); const dq = useDebounced(q, 200)
  const [col, setCol] = useState(-1)
  const [sort, setSort] = useState<{ c: number; dir: 1 | -1 } | null>(null)
  const [scroll, setScroll] = useState(0)
  const worker = useRef<Worker | null>(null)

  useEffect(() => {
    if (!text.trim()) { setRows([]); setErr(''); return }
    setBusy(true)
    worker.current?.terminate()
    const w = new Worker(new URL('../workers/csv.worker.ts', import.meta.url), { type: 'module' })
    worker.current = w
    w.onmessage = (e) => { setBusy(false); if (e.data.ok) { setRows(e.data.rows); setUsed(e.data.delimiter); setErr('') } else { setRows([]); setErr(e.data.error) } }
    w.onerror = () => { setBusy(false); setErr('Failed to parse CSV in worker.') }
    w.postMessage({ text, delimiter })
    return () => w.terminate()
  }, [text, delimiter])

  const heads = useMemo(() => (rows.length ? (header ? rows[0] : rows[0].map((_, i) => `Column ${i + 1}`)) : []), [rows, header])
  const body = useMemo(() => (header ? rows.slice(1) : rows), [rows, header])
  const view = useMemo(() => {
    let v = body
    if (dq) { const ql = dq.toLowerCase(); v = v.filter((r) => (col >= 0 ? [r[col] ?? ''] : r).some((c) => c.toLowerCase().includes(ql))) }
    if (sort) {
      const { c, dir } = sort
      const num = body.length > 0 && body.every((r) => r[c] === '' || r[c] == null || !Number.isNaN(Number(r[c])))
      v = [...v].sort((a, b) => { const x = a[c] ?? '', y = b[c] ?? ''; return (num ? Number(x) - Number(y) : x.localeCompare(y, undefined, { numeric: true })) * dir })
    }
    return v
  }, [body, dq, col, sort])
  const info = useMemo(() => heads.map((h, i) => {
    const vals = body.map((r) => r[i] ?? ''); const nn = vals.filter((v) => v !== '')
    const type = !nn.length ? 'empty' : nn.every((v) => /^-?\d+$/.test(v)) ? 'integer' : nn.every((v) => /^-?\d*\.?\d+$/.test(v)) ? 'number' : nn.every((v) => /^(true|false)$/i.test(v)) ? 'boolean' : nn.every((v) => !Number.isNaN(Date.parse(v)) && /\d{4}-\d{2}-\d{2}/.test(v)) ? 'date' : 'text'
    return { name: h, type, empty: vals.length - nn.length, unique: new Set(nn).size }
  }), [heads, body])
  const start = Math.max(0, Math.floor(scroll / ROW) - 8), end = Math.min(view.length, start + 60)
  const tpl = `minmax(120px,1fr) `.repeat(heads.length)
  return (
    <div className="flex flex-col gap-3">
      <Panel title="Source" actions={<><Button onClick={() => setText(SAMPLE_CSV)}>Sample</Button><FileButton accept=".csv,.tsv,.txt" onText={(t) => setText(t)} /></>}>
        <Textarea aria-label="CSV input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste CSV here or upload a file" rows={4} className="w-full" />
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <Select aria-label="Delimiter" value={delimiter} onChange={(e) => setDelimiter(e.target.value)} className="w-40"><option value="auto">Auto-detect</option><option value=",">Comma</option><option value=";">Semicolon</option><option value={'\t'}>Tab</option><option value="|">Pipe</option></Select>
          <Check_ label="First row is header" checked={header} onChange={setHeader} />
          {busy && <span className="text-xs text-muted-foreground">Parsing…</span>}
        </div>
      </Panel>
      {err && <Notice kind="error">{err}</Notice>}
      {!rows.length && !err ? <Empty>Upload or paste a CSV file to view it as a sortable, searchable table. Parsing runs in a Web Worker.</Empty> : !!rows.length && (
        <>
          <Grid cols={4}><Stat label="Rows" value={body.length.toLocaleString()} /><Stat label="Columns" value={heads.length} /><Stat label="Showing" value={view.length.toLocaleString()} /><Stat label="Delimiter" value={used === '\t' ? 'Tab' : used} /></Grid>
          <Panel title="Table" actions={<><SearchBox value={q} onChange={setQ} placeholder="Filter rows" className="w-48" />
            <Select aria-label="Filter column" value={col} onChange={(e) => setCol(Number(e.target.value))} className="w-40"><option value={-1}>All columns</option>{heads.map((h, i) => <option key={i} value={i}>{h}</option>)}</Select>
            <CopyButton text={() => stringifyCsv([heads, ...view])} label="Copy CSV" /><DownloadButton text={stringifyCsv([heads, ...view])} filename="view.csv" mime="text/csv" /></>}>
            <div className="scroll-thin overflow-auto rounded-md border" style={{ maxHeight: 460 }} onScroll={(e) => setScroll(e.currentTarget.scrollTop)}>
              <div style={{ minWidth: heads.length * 120 }}>
                <div className="sticky top-0 z-10 grid border-b bg-muted text-xs font-semibold" style={{ gridTemplateColumns: tpl }}>
                  {heads.map((h, i) => (
                    <button key={i} onClick={() => setSort((s) => (s?.c === i ? (s.dir === 1 ? { c: i, dir: -1 } : null) : { c: i, dir: 1 }))} className="flex cursor-pointer items-center gap-1 truncate px-2 py-2 text-left hover:bg-border/50" aria-label={`Sort by ${h}`}>
                      <span className="truncate">{h}</span>{sort?.c === i && (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                    </button>))}
                </div>
                <div style={{ height: view.length * ROW, position: 'relative' }}>
                  <div style={{ position: 'absolute', top: start * ROW, left: 0, right: 0 }}>
                    {view.slice(start, end).map((r, i) => (
                      <div key={start + i} className={cn('grid border-b text-[13px]', (start + i) % 2 && 'bg-muted/30')} style={{ gridTemplateColumns: tpl, height: ROW }}>
                        {heads.map((_, c) => <div key={c} className="truncate px-2 py-1.5" title={r[c]}>{r[c]}</div>)}
                      </div>))}
                  </div>
                </div>
              </div>
            </div>
          </Panel>
          <Panel title="Column information">
            <div className="scroll-thin overflow-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted-foreground"><th className="p-1.5">Column</th><th>Type</th><th>Empty</th><th>Unique</th></tr></thead>
              <tbody>{info.map((c, i) => <tr key={i} className="border-t"><td className="p-1.5 font-medium">{c.name}</td><td>{c.type}</td><td>{c.empty}</td><td>{c.unique}</td></tr>)}</tbody></table></div>
          </Panel>
        </>
      )}
    </div>
  )
}
