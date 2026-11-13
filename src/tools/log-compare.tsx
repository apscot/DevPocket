import { useMemo, useState } from 'react'
import { Button, Check_, CopyButton, Empty, FileButton, Grid, Panel, SearchBox, Stat, Textarea } from '@/components/kit'
import { normalizeLogLine, type NormOpts } from '@/lib/logs'
import { diffText } from '@/lib/textdiff'
import { cn } from '@/lib/cn'

const A = `2024-03-11 10:00:01.100 INFO [main] Started app in 3.2 seconds on port 8080
2024-03-11 10:00:02.200 INFO [pool-1-thread-1] Connected to db at 10.0.0.5:5432
2024-03-11 10:00:03.300 WARN [pool-1-thread-2] Cache miss for key 8c1e6b9a-3f1c-4a0e-9f6f-2f2d1c3b7a11
2024-03-11 10:00:04.400 INFO [main] Ready`
const B = `2024-03-12 14:30:11.900 INFO [main] Started app in 5.9 seconds on port 8080
2024-03-12 14:30:12.100 INFO [pool-2-thread-7] Connected to db at 10.1.9.9:5432
2024-03-12 14:30:12.500 ERROR [pool-2-thread-3] Connection refused: redis:6379
2024-03-12 14:30:14.400 INFO [main] Ready`
export default function LogCompare() {
  const [a, setA] = useState(''); const [b, setB] = useState('')
  const [n, setN] = useState<NormOpts>({ timestamps: true, numbers: false, ids: true, threads: true, ips: true, level: false, whitespace: true })
  const [only, setOnly] = useState(true); const [q, setQ] = useState('')
  const res = useMemo(() => {
    if (!a.trim() && !b.trim()) return null
    const la = a.replace(/\r\n?/g, '\n').split('\n'), lb = b.replace(/\r\n?/g, '\n').split('\n')
    const d = diffText(la.map((l) => normalizeLogLine(l, n)).join('\n'), lb.map((l) => normalizeLogLine(l, n)).join('\n'))
    return { ...d, rows: d.rows.map((r) => ({ ...r, l: r.l && { ...r.l, text: la[r.l.n - 1], parts: undefined }, r: r.r && { ...r.r, text: lb[r.r.n - 1], parts: undefined } })) }
  }, [a, b, n])
  const rows = (res?.rows ?? []).filter((r) => (!only || r.kind !== 'same') && (!q || ((r.l?.text ?? '') + (r.r?.text ?? '')).toLowerCase().includes(q.toLowerCase())))
  const tog = (k: keyof NormOpts, label: string) => <Check_ key={k} label={label} checked={!!n[k]} onChange={(v) => setN({ ...n, [k]: v })} />
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Environment A" actions={<FileButton onText={setA} />}><Textarea aria-label="Log A" value={a} onChange={(e) => setA(e.target.value)} rows={9} className="w-full" /></Panel>
        <Panel title="Environment B" actions={<FileButton onText={setB} />}><Textarea aria-label="Log B" value={b} onChange={(e) => setB(e.target.value)} rows={9} className="w-full" /></Panel>
      </div>
      <Panel title="Normalization (ignored when comparing)" actions={<Button onClick={() => { setA(A); setB(B) }}>Sample</Button>}><div className="flex flex-wrap gap-x-5 gap-y-2">{tog('timestamps', 'Timestamps')}{tog('ids', 'UUIDs / long hex')}{tog('ips', 'IP addresses & ports')}{tog('threads', 'Thread names')}{tog('numbers', 'All numbers')}{tog('level', 'Log level')}{tog('whitespace', 'Whitespace')}</div></Panel>
      {!res ? <Empty>Paste logs from two environments. Differences that remain after normalization are highlighted.</Empty> : (<>
        <Grid cols={4}><Stat label="Only in A" value={res.removed} tone="bad" /><Stat label="Only in B" value={res.added} tone="ok" /><Stat label="Differing lines" value={res.modified} tone="warn" /><Stat label="Matching" value={res.rows.filter((r) => r.kind === 'same').length} /></Grid>
        <Panel title="Differences" actions={<><SearchBox value={q} onChange={setQ} placeholder="Search" className="w-44" /><Check_ label="Only differences" checked={only} onChange={setOnly} /><CopyButton text={rows.map((r) => `${r.kind === 'del' ? '- ' : r.kind === 'add' ? '+ ' : r.kind === 'mod' ? '~ ' : '  '}${r.l?.text ?? ''}${r.kind === 'mod' ? '\n  ' + r.r?.text : r.kind === 'add' ? r.r?.text : ''}`).join('\n')} label="Copy" /></>}>
          <div className="scroll-thin max-h-[520px] overflow-auto rounded-md border text-[12.5px]" data-testid="log-diff">
            {rows.map((r, i) => <div key={i} className="grid grid-cols-2 divide-x border-b border-border/50">{(['l', 'r'] as const).map((s) => <div key={s} className={cn('mono flex min-w-0 gap-2 px-2 py-0.5', !r[s] ? 'bg-muted/30' : r.kind === 'del' || (r.kind === 'mod' && s === 'l') ? 'bg-destructive/10' : r.kind === 'add' || (r.kind === 'mod' && s === 'r') ? 'bg-success/10' : '')}><span className="w-8 shrink-0 select-none text-right text-muted-foreground">{r[s]?.n}</span><span className="whitespace-pre-wrap break-all">{r[s]?.text}</span></div>)}</div>)}
            {!rows.length && <p className="p-6 text-center text-sm text-muted-foreground">No differences after normalization.</p>}
          </div>
        </Panel></>)}
    </div>
  )
}
