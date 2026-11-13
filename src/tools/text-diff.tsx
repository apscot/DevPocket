import { useMemo, useState } from 'react'
import { Button, Check_, CopyButton, DownloadButton, Empty, FileButton, Grid, Panel, SearchBox, Select, Stat, Textarea } from '@/components/kit'
import { diffText, unifiedPatch, type DiffRow, type Side } from '@/lib/textdiff'
import { cn } from '@/lib/cn'

const A = 'server.port=8080\nlogging.level=INFO\nfeature.x=false\napp.name=demo\n'
const B = 'server.port=9090\nlogging.level=INFO\napp.name=demo-app\nfeature.y=true\n'

function Cell({ s, kind, side, q }: { s?: Side; kind: DiffRow['kind']; side: 'l' | 'r'; q: string }) {
  const bg = !s ? 'bg-muted/30' : kind === 'del' ? 'bg-destructive/10' : kind === 'add' ? 'bg-success/10' : kind === 'mod' ? (side === 'l' ? 'bg-destructive/10' : 'bg-success/10') : ''
  const hit = q && s?.text.toLowerCase().includes(q.toLowerCase())
  return (
    <div className={cn('flex min-w-0', bg, hit && 'outline outline-1 outline-warning')}>
      <span className="w-10 shrink-0 select-none px-1 text-right text-muted-foreground">{s?.n ?? ''}</span>
      <span className="mono min-w-0 flex-1 whitespace-pre-wrap break-all px-2">
        {s?.parts ? s.parts.map((p, i) => <span key={i} className={cn(p.changed && (side === 'l' ? 'bg-destructive/30' : 'bg-success/30'))}>{p.text}</span>) : s?.text}
      </span>
    </div>
  )
}
export default function TextDiff() {
  const [a, setA] = useState(''); const [b, setB] = useState('')
  const [ws, setWs] = useState(false); const [cs, setCs] = useState(false); const [tr, setTr] = useState(false)
  const [mode, setMode] = useState('split'); const [q, setQ] = useState(''); const [onlyChanges, setOnly] = useState(false)
  const res = useMemo(() => (a || b ? diffText(a, b, { ignoreWhitespace: ws, ignoreCase: cs, trimTrailing: tr }) : null), [a, b, ws, cs, tr])
  const rows = (res?.rows ?? []).filter((r) => (!onlyChanges || r.kind !== 'same') && (!q || ((r.l?.text ?? '') + (r.r?.text ?? '')).toLowerCase().includes(q.toLowerCase())))
  const patch = useMemo(() => (res ? unifiedPatch(a, b) : ''), [res, a, b])
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Original" actions={<FileButton onText={setA} />}><Textarea aria-label="Original text" value={a} onChange={(e) => setA(e.target.value)} rows={10} className="w-full" /></Panel>
        <Panel title="Modified" actions={<FileButton onText={setB} />}><Textarea aria-label="Modified text" value={b} onChange={(e) => setB(e.target.value)} rows={10} className="w-full" /></Panel>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Button onClick={() => { setA(A); setB(B) }}>Load sample</Button>
        <Check_ label="Ignore whitespace" checked={ws} onChange={setWs} /><Check_ label="Ignore case" checked={cs} onChange={setCs} /><Check_ label="Trim trailing space" checked={tr} onChange={setTr} /><Check_ label="Only changes" checked={onlyChanges} onChange={setOnly} />
        <Select aria-label="View" value={mode} onChange={(e) => setMode(e.target.value)} className="w-40"><option value="split">Side by side</option><option value="unified">Unified</option></Select>
      </div>
      {!res ? <Empty>Paste or upload two texts to compare them.</Empty> : (
        <>
          <Grid cols={4}><Stat label="Added lines" value={res.added} tone="ok" /><Stat label="Removed lines" value={res.removed} tone="bad" /><Stat label="Modified lines" value={res.modified} tone="warn" /><Stat label="Identical" value={res.rows.filter((r) => r.kind === 'same').length} /></Grid>
          <Panel title="Diff" actions={<><SearchBox value={q} onChange={setQ} placeholder="Search lines" className="w-48" /><CopyButton text={patch} label="Copy patch" /><DownloadButton text={patch} filename="changes.patch" mime="text/x-diff" label="Export patch" /></>}>
            <div className="scroll-thin max-h-[520px] overflow-auto rounded-md border text-[13px]" data-testid="text-diff">
              {mode === 'split' ? rows.map((r, i) => <div key={i} className="grid grid-cols-2 divide-x border-b border-border/50"><Cell s={r.l} kind={r.kind} side="l" q={q} /><Cell s={r.r} kind={r.kind} side="r" q={q} /></div>)
                : rows.flatMap((r, i) => r.kind === 'same' ? [<Cell key={i} s={r.l} kind="same" side="l" q={q} />] : r.kind === 'mod' ? [<Cell key={i + 'a'} s={r.l} kind="del" side="l" q={q} />, <Cell key={i + 'b'} s={r.r} kind="add" side="r" q={q} />] : [<Cell key={i} s={r.l ?? r.r} kind={r.kind} side={r.l ? 'l' : 'r'} q={q} />])}
              {!rows.length && <p className="p-4 text-center text-muted-foreground">{res.added + res.removed + res.modified === 0 ? 'Texts are identical.' : 'No lines match.'}</p>}
            </div>
          </Panel>
        </>
      )}
    </div>
  )
}
