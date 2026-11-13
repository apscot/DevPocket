import { useDeferredValue, useMemo, useState } from 'react'
import { Button, Check_, CopyButton, DownloadButton, Empty, Grid, InputPane, Notice, Panel, SearchBox, Select, Stat, Hl } from '@/components/kit'
import { LEVELS, groupKey, parseLogs, type Level, type LogEntry } from '@/lib/logs'
import { BUILTIN_RULES, detectSecrets, redact } from '@/lib/security'
import { isoInTz, localTz } from '@/lib/datetime'
import { cn } from '@/lib/cn'

const SAMPLE = `2024-03-11 10:15:41.101 INFO 4121 --- [main] c.e.app.Application : Started Application in 3.2 seconds
2024-03-11 10:15:42.123 ERROR 4121 --- [nio-8080-exec-3] c.e.web.UserController : Failed to create user id=1042 password=hunter2
java.lang.IllegalStateException: boom
\tat com.example.UserService.create(UserService.java:58)
2024-03-11 10:15:43.001 WARN 4121 --- [nio-8080-exec-1] c.e.web.UserController : Slow request took 1532 ms
2024-03-11 10:15:44.001 WARN 4121 --- [nio-8080-exec-2] c.e.web.UserController : Slow request took 2210 ms
2024-03-11 10:15:45.500 DEBUG 4121 --- [nio-8080-exec-2] c.e.repo.UserRepo : query took 12 ms
2024-03-11 10:15:46.010 INFO 4121 --- [nio-8080-exec-4] c.e.auth.Auth : token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhIn0.abc issued for 8c1e6b9a-3f1c-4a0e-9f6f-2f2d1c3b7a11`
const color: Record<Level, string> = { TRACE: 'text-muted-foreground', DEBUG: 'text-muted-foreground', INFO: 'text-primary', WARN: 'text-warning', ERROR: 'text-destructive', FATAL: 'text-destructive', UNKNOWN: 'text-muted-foreground' }
export default function LogWorkbench() {
  const [t, setT] = useState(''); const dt = useDeferredValue(t)
  const [levels, setLevels] = useState<Set<Level>>(new Set(LEVELS)); const [q, setQ] = useState(''); const [regex, setRegex] = useState(false); const [invert, setInvert] = useState(false)
  const [group, setGroup] = useState(false); const [red, setRed] = useState(false); const [tsFmt, setTsFmt] = useState('original'); const [limit, setLimit] = useState(500)
  const entries = useMemo(() => parseLogs(dt), [dt])
  const { list, err } = useMemo(() => {
    let re: RegExp | null = null
    try { if (q && regex) re = new RegExp(q, 'i') } catch (e) { return { list: [] as LogEntry[], err: (e as Error).message } }
    const ql = q.toLowerCase()
    const l = entries.filter((e) => levels.has(e.level) && (!q || (re ? re.test(e.raw) : e.raw.toLowerCase().includes(ql)) !== invert))
    return { list: l, err: '' }
  }, [entries, levels, q, regex, invert])
  const redactText = (s: string) => (red ? redact(s, detectSecrets(s, BUILTIN_RULES.filter((r) => r.enabled !== false))) : s)
  const fmtLine = (e: LogEntry) => { let r = e.raw; if (tsFmt !== 'original' && e.ts && e.tsMs !== undefined) r = r.replace(e.ts, tsFmt === 'iso' ? new Date(e.tsMs).toISOString() : tsFmt === 'local' ? isoInTz(e.tsMs, localTz()) : String(e.tsMs)); return redactText(r) }
  const groups = useMemo(() => { const m = new Map<string, { n: number; sample: LogEntry; level: Level }>(); list.forEach((e) => { const k = e.level + '|' + groupKey(e.message); const g = m.get(k); if (g) g.n++; else m.set(k, { n: 1, sample: e, level: e.level }) }); return [...m.values()].sort((a, b) => b.n - a.n) }, [list])
  const counts = useMemo(() => { const c: Record<string, number> = {}; entries.forEach((e) => (c[e.level] = (c[e.level] ?? 0) + 1)); return c }, [entries])
  const exportText = list.map(fmtLine).join('\n')
  return (
    <div className="flex flex-col gap-3">
      <Notice kind="info">Logs are parsed and filtered locally; nothing is uploaded. Enable “Redact secrets” before sharing excerpts.</Notice>
      <InputPane title="Log input" value={t} onChange={setT} sample={SAMPLE} accept=".log,.txt,text/plain" rows={8} />
      {!entries.length ? <Empty>Paste or upload a log. Multi-line entries (stack traces) are kept with their parent line.</Empty> : (<>
        <Grid cols={4}><Stat label="Entries" value={entries.length.toLocaleString()} /><Stat label="Shown" value={list.length.toLocaleString()} /><Stat label="Errors" value={(counts.ERROR ?? 0) + (counts.FATAL ?? 0)} tone={(counts.ERROR ?? 0) ? 'bad' : undefined} /><Stat label="Warnings" value={counts.WARN ?? 0} tone={counts.WARN ? 'warn' : undefined} /></Grid>
        <Panel title="Filters"><div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <SearchBox value={q} onChange={setQ} placeholder={regex ? 'Regex filter' : 'Search text'} className="w-56" /><Check_ label="Regex" checked={regex} onChange={setRegex} /><Check_ label="Invert" checked={invert} onChange={setInvert} />
          <div className="flex flex-wrap gap-1" role="group" aria-label="Levels">{LEVELS.map((l) => <button key={l} aria-pressed={levels.has(l)} onClick={() => setLevels((s) => { const n = new Set(s); if (n.has(l)) n.delete(l); else n.add(l); return n })} className={cn('cursor-pointer rounded-full border px-2.5 py-0.5 text-xs', levels.has(l) ? 'border-primary bg-accent' : 'text-muted-foreground opacity-60')}><span className={color[l]}>{l}</span> {counts[l] ?? 0}</button>)}</div>
          <Check_ label="Group repeated messages" checked={group} onChange={setGroup} /><Check_ label="Redact secrets" checked={red} onChange={setRed} />
          <Select aria-label="Timestamp format" value={tsFmt} onChange={(e) => setTsFmt(e.target.value)} className="w-44"><option value="original">Timestamps: original</option><option value="iso">ISO-8601 (UTC)</option><option value="local">Local time zone</option><option value="epoch">Epoch ms</option></Select>
        </div>{err && <p className="mt-2 text-xs text-destructive">Invalid regex: {err}</p>}</Panel>
        <Panel title={group ? `Grouped messages (${groups.length})` : `Entries (${list.length})`} actions={<><CopyButton text={exportText} label="Copy" /><DownloadButton text={exportText} filename="filtered.log" /></>}>
          <div className="scroll-thin max-h-[520px] overflow-auto rounded-md border bg-background" data-testid="log-list">
            {group ? groups.slice(0, limit).map((g, i) => <div key={i} className="flex gap-3 border-b px-3 py-1.5 text-[13px]"><span className="mono w-12 shrink-0 text-right font-semibold text-primary">×{g.n}</span><span className={cn('mono w-14 shrink-0', color[g.level])}>{g.level}</span><span className="mono min-w-0 break-all">{redactText(g.sample.message.split('\n')[0])}</span></div>)
              : list.slice(0, limit).map((e) => <div key={e.n} className="flex gap-2 border-b px-3 py-1 text-[13px]"><span className="mono w-10 shrink-0 select-none text-right text-muted-foreground">{e.n}</span><pre className={cn('mono min-w-0 whitespace-pre-wrap break-all', e.level === 'ERROR' || e.level === 'FATAL' ? 'text-destructive' : e.level === 'WARN' ? 'text-warning' : '')}><Hl text={fmtLine(e)} q={regex ? '' : q} /></pre></div>)}
            {!(group ? groups : list).length && <p className="p-6 text-center text-sm text-muted-foreground">No entries match the filters.</p>}
          </div>
          {(group ? groups : list).length > limit && <div className="mt-2"><Button onClick={() => setLimit(limit + 1000)}>Show more</Button></div>}
        </Panel>
      </>)}
    </div>
  )
}
