import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import { Empty, Grid, InputPane, Notice, Panel, Stat } from '@/components/kit'
import { EXPLAIN, analyze, parseHeaders, type Sev } from '@/lib/http'
import { cn } from '@/lib/cn'

const SAMPLE = `HTTP/1.1 200 OK
Content-Type: text/html
Cache-Control: public, max-age=3600
Server: nginx/1.18.0
X-Powered-By: Express
Access-Control-Allow-Origin: *
Access-Control-Allow-Credentials: true
Set-Cookie: sid=abc123; Path=/
Strict-Transport-Security: max-age=300
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'`
const icon: Record<Sev, [typeof Info, string]> = { error: [XCircle, 'text-destructive'], warn: [AlertTriangle, 'text-warning'], info: [Info, 'text-primary'], ok: [CheckCircle2, 'text-success'] }
export default function HeaderAnalyzer() {
  const [t, setT] = useState('')
  const r = useMemo(() => { if (!t.trim()) return null; const p = parseHeaders(t); return { p, f: analyze(p) } }, [t])
  const n = (s: Sev) => r?.f.filter((x) => x.sev === s).length ?? 0
  return (
    <div className="flex flex-col gap-3">
      <Notice kind="info">Paste headers copied from DevTools, curl -i or a log. This tool only analyzes pasted text — it never fetches websites.</Notice>
      <div className="grid gap-3 lg:grid-cols-2">
        <InputPane title="Headers" value={t} onChange={setT} sample={SAMPLE} placeholder={'HTTP/1.1 200 OK\nContent-Type: application/json\n…'} />
        <div className="flex min-w-0 flex-col gap-3">
          {!r ? <Empty>Paste a request or response header block.</Empty> : (
            <>
              {r.p.errors.map((e, i) => <Notice key={i} kind="error">{e}</Notice>)}
              <Grid cols={4}><Stat label="Type" value={r.p.kind} /><Stat label="Headers" value={r.p.headers.length} /><Stat label="Errors" value={n('error')} tone={n('error') ? 'bad' : undefined} /><Stat label="Warnings" value={n('warn')} tone={n('warn') ? 'warn' : undefined} /></Grid>
              <Panel title="Findings"><ul className="space-y-1.5">{r.f.map((f, i) => { const [I, c] = icon[f.sev]; return <li key={i} className="flex gap-2 text-sm" data-sev={f.sev}><I size={15} className={cn('mt-0.5 shrink-0', c)} /><span><b className="mono text-[13px]">{f.header}</b> — {f.message}</span></li> })}</ul></Panel>
            </>
          )}
        </div>
      </div>
      {r && r.p.headers.length > 0 && <Panel title="Header reference"><table className="w-full text-sm"><tbody>{r.p.headers.map((h, i) => (
        <tr key={i} className="border-t align-top"><td className="mono w-56 py-1.5 pr-3 font-medium text-primary">{h.name}</td><td className="mono break-all pr-3">{h.value}</td><td className="hidden w-80 text-xs text-muted-foreground md:table-cell">{EXPLAIN[h.name.toLowerCase()] ?? (h.name.toLowerCase().startsWith('x-') ? 'Non-standard custom header.' : '')}</td></tr>))}</tbody></table></Panel>}
    </div>
  )
}
