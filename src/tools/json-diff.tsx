import { useMemo, useState } from 'react'
import { Empty, Grid, Notice, Panel, SearchBox, Select, Stat, Check_, CopyButton, DownloadButton, Textarea, Button, Hl, FileButton } from '@/components/kit'
import { diffCounts, diffJson, parseJson, type DiffEntry, type DiffKind } from '@/lib/json'
import { cn } from '@/lib/cn'

const A = `{"id":1,"name":"Ada","roles":["admin","dev"],"profile":{"age":36,"city":"London"},"active":true}`
const B = `{"profile":{"city":"Paris","age":"36"},"id":1,"name":"Ada","roles":["dev","admin","ops"],"nickname":"A"}`
const kindStyle: Record<DiffKind, string> = { added: 'bg-success/10 text-success', removed: 'bg-destructive/10 text-destructive', modified: 'bg-warning/10 text-warning', typeChanged: 'bg-primary/10 text-primary', unchanged: 'bg-muted text-muted-foreground' }
const show = (v: unknown) => (v === undefined ? '—' : JSON.stringify(v))

export function diffToCsv(d: DiffEntry[]) {
  const e = (s: string) => `"${s.replace(/"/g, '""')}"`
  return ['path,change,left,right', ...d.map((x) => [e(x.path), x.kind, e(show(x.left)), e(show(x.right))].join(','))].join('\n')
}
export default function JsonDiff() {
  const [a, setA] = useState(''); const [b, setB] = useState('')
  const [arrayMode, setArrayMode] = useState<'index' | 'unordered'>('index')
  const [unchanged, setUnchanged] = useState(false)
  const [q, setQ] = useState(''); const [kind, setKind] = useState('all')
  const res = useMemo(() => {
    if (!a.trim() || !b.trim()) return null
    try { return { diff: diffJson(parseJson(a), parseJson(b), { arrayMode, includeUnchanged: unchanged }), err: '' } } catch (e) { return { diff: [] as DiffEntry[], err: (e as Error).message } }
  }, [a, b, arrayMode, unchanged])
  const diff = res?.diff ?? []
  const c = diffCounts(diff)
  const list = diff.filter((d) => (kind === 'all' || d.kind === kind) && (!q || (d.path + show(d.left) + show(d.right)).toLowerCase().includes(q.toLowerCase())))
  const json = JSON.stringify(list, null, 2)
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Left (original)" actions={<FileButton accept=".json" onText={setA} />}><Textarea aria-label="Left JSON" value={a} onChange={(e) => setA(e.target.value)} rows={10} className="w-full" placeholder="Original JSON" /></Panel>
        <Panel title="Right (changed)" actions={<FileButton accept=".json" onText={setB} />}><Textarea aria-label="Right JSON" value={b} onChange={(e) => setB(e.target.value)} rows={10} className="w-full" placeholder="Changed JSON" /></Panel>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Button onClick={() => { setA(A); setB(B) }}>Load sample</Button>
        <Select aria-label="Array comparison" value={arrayMode} onChange={(e) => setArrayMode(e.target.value as 'index' | 'unordered')} className="w-56"><option value="index">Arrays: compare by index</option><option value="unordered">Arrays: ignore order</option></Select>
        <Check_ label="Show unchanged" checked={unchanged} onChange={setUnchanged} />
        <span className="text-xs text-muted-foreground">Object key order is always ignored.</span>
      </div>
      {res?.err && <Notice kind="error">{res.err}</Notice>}
      {!res ? <Empty>Paste two JSON documents to compare them.</Empty> : !res.err && (
        <>
          <Grid cols={4}><Stat label="Added" value={c.added} tone="ok" /><Stat label="Removed" value={c.removed} tone="bad" /><Stat label="Modified" value={c.modified} tone="warn" /><Stat label="Type changed" value={c.typeChanged} /></Grid>
          {!diff.some((d) => d.kind !== 'unchanged') && <Notice kind="success">The documents are semantically identical.</Notice>}
          <Panel title={`Differences (${list.length})`} actions={<>
            <SearchBox value={q} onChange={setQ} placeholder="Search path or value" className="w-52" />
            <Select aria-label="Filter by type" value={kind} onChange={(e) => setKind(e.target.value)} className="w-36"><option value="all">All changes</option><option value="added">Added</option><option value="removed">Removed</option><option value="modified">Modified</option><option value="typeChanged">Type changed</option></Select>
            <CopyButton text={json} label="Copy JSON" /><DownloadButton text={json} filename="json-diff.json" mime="application/json" label="JSON" /><DownloadButton text={diffToCsv(list)} filename="json-diff.csv" mime="text/csv" label="CSV" /></>}>
            <div className="scroll-thin max-h-[460px] overflow-auto" data-testid="diff-list">
              <table className="w-full text-sm"><thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground"><tr><th className="p-1.5">Path</th><th>Change</th><th>Left</th><th>Right</th></tr></thead>
                <tbody>{list.slice(0, 2000).map((d, i) => (
                  <tr key={i} className="border-t align-top"><td className="mono p-1.5"><Hl text={d.path} q={q} /></td>
                    <td><span className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium', kindStyle[d.kind])}>{d.kind}</span></td>
                    <td className="mono max-w-[260px] break-all text-destructive/90">{show(d.left)}</td><td className="mono max-w-[260px] break-all text-success">{show(d.right)}</td></tr>))}</tbody></table>
              {list.length > 2000 && <p className="p-2 text-xs text-muted-foreground">Showing first 2000 of {list.length}. Use filters or export for the full list.</p>}
              {!list.length && <p className="p-4 text-center text-sm text-muted-foreground">No differences match the current filter.</p>}
            </div>
          </Panel>
        </>
      )}
    </div>
  )
}
