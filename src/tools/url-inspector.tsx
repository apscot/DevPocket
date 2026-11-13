import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button, CopyButton, Empty, Field, Input, Notice, Panel, Stat, Grid } from '@/components/kit'

type P = [string, string]
export default function UrlInspector() {
  const [raw, setRaw] = useState('')
  const [params, setParams] = useState<P[]>([])
  const parsed = useMemo(() => { if (!raw.trim()) return null; try { return { u: new URL(raw.trim()), err: '' } } catch { return { u: null, err: 'Not a valid absolute URL (include a scheme, e.g. https://example.com).' } } }, [raw])
  const setUrl = (v: string) => { setRaw(v); try { setParams([...new URL(v.trim()).searchParams.entries()]) } catch { /* ignore */ } }
  const u = parsed?.u
  const rebuilt = useMemo(() => { if (!u) return ''; const c = new URL(u.href); c.search = ''; params.forEach(([k, v]) => { if (k) c.searchParams.append(k, v) }); return c.href }, [u, params])
  const set = (i: number, j: 0 | 1, v: string) => setParams(params.map((p, k) => (k === i ? (j ? [p[0], v] : [v, p[1]]) : p) as P))
  return (
    <div className="flex flex-col gap-3">
      <Panel title="URL"><Input aria-label="URL" value={raw} onChange={(e) => setUrl(e.target.value)} placeholder="https://user:pass@example.com:8443/path/to?x=1&y=two#frag" className="mono" />
        <Button className="mt-2" onClick={() => setUrl('https://api.example.com:8443/v1/users/42?include=orders&sort=-created&q=hello%20world#section-2')}>Sample</Button></Panel>
      {parsed?.err && <Notice kind="error">{parsed.err}</Notice>}
      {!parsed && <Empty>Enter a URL to break it into parts, edit query parameters and rebuild it.</Empty>}
      {u && (
        <>
          <Grid cols={4}>
            <Stat label="Protocol" value={u.protocol} /><Stat label="Host" value={u.hostname} /><Stat label="Port" value={u.port || `(default ${u.protocol === 'https:' ? 443 : u.protocol === 'http:' ? 80 : '—'})`} /><Stat label="Origin" value={u.origin} />
            <Stat label="Path" value={u.pathname} /><Stat label="Query" value={u.search || '—'} /><Stat label="Fragment" value={u.hash || '—'} /><Stat label="Credentials" value={u.username ? `${u.username}:${u.password ? '••••' : ''}` : '—'} />
          </Grid>
          <Panel title="Path segments"><div className="mono flex flex-wrap gap-1.5 text-sm">{u.pathname.split('/').filter(Boolean).map((s, i) => <span key={i} className="rounded border px-2 py-0.5">{decodeURIComponentSafe(s)}</span>)}{u.pathname === '/' && <span className="text-muted-foreground">(root)</span>}</div></Panel>
          <Panel title={`Query parameters (${params.length})`} actions={<Button onClick={() => setParams([...params, ['', '']])}><Plus size={14} />Add</Button>}>
            <div className="space-y-2">{params.map(([k, v], i) => (
              <div key={i} className="flex gap-2"><Input aria-label={`Param ${i + 1} name`} value={k} onChange={(e) => set(i, 0, e.target.value)} placeholder="name" className="mono" /><Input aria-label={`Param ${i + 1} value`} value={v} onChange={(e) => set(i, 1, e.target.value)} placeholder="value" className="mono" />
                <Button variant="ghost" size="icon" aria-label="Remove parameter" onClick={() => setParams(params.filter((_, j) => j !== i))}><Trash2 size={14} /></Button></div>))}
              {!params.length && <p className="text-sm text-muted-foreground">No query parameters.</p>}</div>
          </Panel>
          <Panel title="Rebuilt URL" actions={<CopyButton text={rebuilt} />}><code className="mono break-all text-sm" data-testid="rebuilt">{rebuilt}</code>
            <Field label="Decoded view" className="mt-3"><code className="mono break-all text-xs text-muted-foreground">{decodeURIComponentSafe(rebuilt)}</code></Field></Panel>
        </>
      )}
    </div>
  )
}
function decodeURIComponentSafe(s: string) { try { return decodeURIComponent(s) } catch { return s } }
