import { useMemo, useState } from 'react'
import { ChevronRight, Lock } from 'lucide-react'
import { Button, CopyButton, DownloadButton, Empty, Grid, Hl, InputPane, Notice, Panel, SearchBox, Stat, Tabs, useDebounced } from '@/components/kit'
import { cn } from '@/lib/cn'
import { SAMPLE_SPEC, deref, exampleFor, loadModel, schemaRows, stats, toCurl, toMarkdown, typeLabel } from '@/lib/openapi'
import type { Body, Endpoint, Json, Method, Model } from '@/lib/openapi'

const COLORS: Record<string, string> = {
  get: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300', post: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  put: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300', patch: 'border-teal-500/40 bg-teal-500/10 text-teal-700 dark:text-teal-300',
  delete: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300', head: 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  options: 'border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-300', trace: 'border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-300',
}
const codeTone = (c: string) => (c.startsWith('2') ? 'text-success' : c.startsWith('3') ? 'text-sky-600 dark:text-sky-300' : c.startsWith('4') ? 'text-warning' : c.startsWith('5') ? 'text-destructive' : 'text-muted-foreground')
const MethodBadge = ({ m }: { m: string }) => <span className={cn('mono inline-block w-16 shrink-0 rounded border px-1.5 py-0.5 text-center text-[11px] font-bold uppercase', COLORS[m])}>{m}</span>
const json = (v: unknown) => JSON.stringify(v, null, 2) ?? 'null'

function Code({ text, label }: { text: string; label?: string }) {
  return (
    <div className="relative">
      <pre className="mono max-h-72 overflow-auto rounded-md border bg-muted/40 p-2.5 pr-16 text-xs leading-relaxed">{text}</pre>
      <div className="absolute right-1.5 top-1.5"><CopyButton text={text} label={label ?? 'Copy'} size="icon" /></div>
    </div>
  )
}

function SchemaView({ model, schema }: { model: Model; schema: Json }) {
  const rows = useMemo(() => schemaRows(model.raw, schema), [model, schema])
  const [view, setView] = useState<'model' | 'example'>('model')
  const example = useMemo(() => json(exampleFor(model.raw, schema)), [model, schema])
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Tabs value={view} onChange={setView} items={[['model', 'Model'], ['example', 'Example']]} />
        <span className="mono text-xs text-muted-foreground">{typeLabel(model.raw, schema)}</span>
      </div>
      {view === 'example' ? <Code text={example} label="Copy example" /> : rows.length ? (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[480px] text-left text-xs">
            <thead className="bg-muted/50 text-muted-foreground"><tr><th className="px-2 py-1.5">Field</th><th className="px-2 py-1.5">Type</th><th className="px-2 py-1.5">Description</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t align-top">
                  <td className="mono px-2 py-1.5" style={{ paddingLeft: 8 + r.depth * 16 }}>{r.name}{r.required && <span className="ml-0.5 text-destructive" title="required">*</span>}</td>
                  <td className="mono px-2 py-1.5 text-primary">{r.type}</td>
                  <td className="px-2 py-1.5">{r.description}{r.extras.length > 0 && <div className="mono mt-0.5 text-[11px] text-muted-foreground">{r.extras.join(' · ')}</div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="text-xs text-muted-foreground">No object fields — see the example for the shape.</p>}
    </div>
  )
}

function BodyBlock({ model, bodies }: { model: Model; bodies: Body[] }) {
  const [i, setI] = useState(0)
  if (!bodies.length) return null
  const b = bodies[Math.min(i, bodies.length - 1)]
  return (
    <div className="flex flex-col gap-2">
      {bodies.length > 1 && <Tabs value={String(i)} onChange={(v) => setI(Number(v))} items={bodies.map((x, k) => [String(k), x.contentType] as [string, string])} />}
      {bodies.length === 1 && <span className="mono text-xs text-muted-foreground">{b.contentType}</span>}
      <SchemaView model={model} schema={b.example !== undefined && !Object.keys(b.schema).length ? { example: b.example } : b.schema} />
    </div>
  )
}

const H = ({ children }: { children: React.ReactNode }) => <h4 className="mb-1.5 mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground first:mt-0">{children}</h4>

function EndpointDetail({ model, e, server }: { model: Model; e: Endpoint; server: string }) {
  const curl = useMemo(() => toCurl(model, e, server || undefined), [model, e, server])
  return (
    <div className="border-t bg-card px-3 py-3 text-[13px]">
      {e.description && <p className="mb-2 whitespace-pre-wrap text-muted-foreground">{e.description}</p>}
      {e.operationId && <p className="mb-2 text-xs text-muted-foreground">operationId: <span className="mono text-foreground">{e.operationId}</span></p>}
      {e.security.length > 0 && <p className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"><Lock size={12} />Requires: {e.security.map((s) => <span key={s} className="mono rounded border px-1.5 py-0.5 text-foreground">{s}</span>)}</p>}
      {e.params.length > 0 && (
        <>
          <H>Parameters</H>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[480px] text-left text-xs">
              <thead className="bg-muted/50 text-muted-foreground"><tr><th className="px-2 py-1.5">Name</th><th className="px-2 py-1.5">In</th><th className="px-2 py-1.5">Type</th><th className="px-2 py-1.5">Description</th></tr></thead>
              <tbody>
                {e.params.map((p) => (
                  <tr key={`${p.in}:${p.name}`} className={cn('border-t align-top', p.deprecated && 'opacity-60')}>
                    <td className="mono px-2 py-1.5">{p.name}{p.required && <span className="ml-0.5 text-destructive" title="required">*</span>}</td>
                    <td className="px-2 py-1.5">{p.in}</td>
                    <td className="mono px-2 py-1.5 text-primary">{typeLabel(model.raw, p.schema)}</td>
                    <td className="px-2 py-1.5">{p.description}{(() => { const s = (p.schema?.$ref ? deref(model.raw, p.schema.$ref) : p.schema) ?? {}; const x = [s.enum ? `enum: ${s.enum.join(', ')}` : '', s.default !== undefined ? `default: ${JSON.stringify(s.default)}` : '', s.minimum !== undefined ? `min ${s.minimum}` : '', s.maximum !== undefined ? `max ${s.maximum}` : ''].filter(Boolean).join(' · '); return x ? <div className="mono mt-0.5 text-[11px] text-muted-foreground">{x}</div> : null })()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {e.body && (
        <>
          <H>Request body{e.body.required && <span className="ml-1 normal-case text-destructive">required</span>}</H>
          {e.body.description && <p className="mb-1.5 text-xs text-muted-foreground">{e.body.description}</p>}
          <BodyBlock model={model} bodies={e.body.bodies} />
        </>
      )}
      <H>Responses</H>
      <div className="flex flex-col gap-2">
        {e.responses.map((r) => (
          <details key={r.code} className="rounded-md border" open={r.code.startsWith('2') && r.bodies.length > 0}>
            <summary className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5"><span className={cn('mono font-bold', codeTone(r.code))}>{r.code}</span><span className="min-w-0 truncate">{r.description || '—'}</span>{r.bodies.length === 0 && <span className="ml-auto text-[11px] text-muted-foreground">no body</span>}</summary>
            <div className="border-t p-2.5">
              {r.headers.length > 0 && <p className="mb-2 text-xs text-muted-foreground">Headers: {r.headers.map((h) => <span key={h} className="mono mr-1.5 text-foreground">{h}</span>)}</p>}
              {r.bodies.length ? <BodyBlock model={model} bodies={r.bodies} /> : <p className="text-xs text-muted-foreground">No response body.</p>}
            </div>
          </details>
        ))}
        {!e.responses.length && <p className="text-xs text-muted-foreground">No responses documented.</p>}
      </div>
      <H>cURL</H>
      <Code text={curl} label="Copy cURL" />
    </div>
  )
}

function Endpoints({ model }: { model: Model }) {
  const [q, setQ] = useState(''); const dq = useDebounced(q, 150).trim().toLowerCase()
  const [methods, setMethods] = useState<Set<Method>>(new Set())
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [closedTags, setClosedTags] = useState<Set<string>>(new Set())
  const [server, setServer] = useState('')
  const present = useMemo(() => [...new Set(model.endpoints.map((e) => e.method))], [model])
  const match = (e: Endpoint) => (!methods.size || methods.has(e.method)) && (!dq || `${e.method} ${e.path} ${e.summary} ${e.operationId} ${e.description} ${e.tags.join(' ')}`.toLowerCase().includes(dq))
  const groups = model.tags.map((t) => ({ t, eps: model.endpoints.filter((e) => e.tags.includes(t.name) && match(e)) })).filter((g) => g.eps.length)
  const total = groups.reduce((n, g) => n + g.eps.length, 0)
  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); if (!n.delete(id)) n.add(id); return n })
  const all = groups.flatMap((g) => g.eps.map((e) => `${g.t.name}|${e.id}`))
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchBox className="min-w-52 flex-1" value={q} onChange={setQ} placeholder="Search path, summary, operationId…" />
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by method">
          {present.map((m) => <button key={m} aria-pressed={methods.has(m)} onClick={() => setMethods((s) => { const n = new Set(s); if (!n.delete(m)) n.add(m); return n })} className={cn('mono cursor-pointer rounded border px-2 py-1 text-[11px] font-bold uppercase', methods.has(m) ? COLORS[m] : 'text-muted-foreground opacity-70 hover:opacity-100')}>{m}</button>)}
        </div>
        <Button onClick={() => setOpen(open.size ? new Set() : new Set(all))}>{open.size ? 'Collapse all' : 'Expand all'}</Button>
      </div>
      {model.servers.length > 1 && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">Server for cURL
          <select value={server} onChange={(e) => setServer(e.target.value)} className="mono h-8 rounded-md border bg-background px-2 text-xs text-foreground">
            {model.servers.map((s) => <option key={s.url} value={s.url}>{s.url}{s.description ? ` — ${s.description}` : ''}</option>)}
          </select>
        </label>
      )}
      <p className="text-xs text-muted-foreground" aria-live="polite">{total} of {model.endpoints.length} endpoints</p>
      {!groups.length && <Empty>No endpoints match your filters.</Empty>}
      {groups.map(({ t, eps }) => {
        const closed = closedTags.has(t.name)
        return (
          <section key={t.name} className="rounded-lg border">
            <button aria-expanded={!closed} onClick={() => setClosedTags((s) => { const n = new Set(s); if (!n.delete(t.name)) n.add(t.name); return n })} className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left">
              <ChevronRight size={15} className={cn('shrink-0 transition-transform', !closed && 'rotate-90')} />
              <span className="font-semibold">{t.name}</span><span className="text-xs text-muted-foreground">{eps.length}</span>
              {t.description && <span className="hidden min-w-0 truncate text-xs text-muted-foreground sm:inline">— {t.description}</span>}
            </button>
            {!closed && (
              <div className="flex flex-col gap-1.5 border-t p-2">
                {eps.map((e) => {
                  const key = `${t.name}|${e.id}`; const isOpen = open.has(key)
                  return (
                    <div key={key} data-testid="endpoint" className={cn('overflow-hidden rounded-md border', COLORS[e.method])}>
                      <button aria-expanded={isOpen} onClick={() => toggle(key)} className="flex w-full cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-2.5 py-1.5 text-left text-foreground">
                        <MethodBadge m={e.method} />
                        <span className={cn('mono min-w-0 break-all text-[13px] font-semibold', e.deprecated && 'line-through opacity-60')}><Hl text={e.path} q={dq} /></span>
                        {e.deprecated && <span className="rounded bg-warning/15 px-1.5 text-[10px] font-semibold uppercase text-warning">deprecated</span>}
                        {e.summary && <span className="min-w-0 truncate text-xs text-muted-foreground sm:ml-auto"><Hl text={e.summary} q={dq} /></span>}
                        {e.security.length > 0 && <Lock size={12} className="shrink-0 text-muted-foreground" aria-label="requires authentication" />}
                      </button>
                      {isOpen && <EndpointDetail model={model} e={e} server={server} />}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

function Schemas({ model }: { model: Model }) {
  const [q, setQ] = useState(''); const [sel, setSel] = useState<string | null>(null)
  const list = model.schemas.filter((s) => s.name.toLowerCase().includes(q.trim().toLowerCase()))
  const cur = model.schemas.find((s) => s.name === sel) ?? list[0]
  if (!model.schemas.length) return <Empty>This document defines no reusable schemas.</Empty>
  return (
    <div className="grid gap-3 md:grid-cols-[220px_1fr]">
      <div className="flex min-w-0 flex-col gap-2">
        <SearchBox value={q} onChange={setQ} placeholder="Filter schemas…" />
        <div className="flex max-h-[60vh] flex-col gap-0.5 overflow-auto">
          {list.map((s) => <button key={s.name} aria-current={cur?.name === s.name} onClick={() => setSel(s.name)} className={cn('mono cursor-pointer truncate rounded px-2 py-1 text-left text-xs', cur?.name === s.name ? 'bg-accent font-semibold' : 'hover:bg-muted')}>{s.name}</button>)}
          {!list.length && <p className="px-2 text-xs text-muted-foreground">No match.</p>}
        </div>
      </div>
      {cur && (
        <Panel title={<span className="mono">{cur.name}</span>}>
          {cur.schema?.description && <p className="mb-2 text-sm text-muted-foreground">{cur.schema.description}</p>}
          <SchemaView key={cur.name} model={model} schema={{ $ref: `#/${model.kind === 'swagger2' ? 'definitions' : 'components/schemas'}/${cur.name}` }} />
          <UsedBy model={model} name={cur.name} />
        </Panel>
      )}
    </div>
  )
}
function UsedBy({ model, name }: { model: Model; name: string }) {
  const hits = useMemo(() => {
    const needle = `/${name}"`
    return model.endpoints.filter((e) => JSON.stringify([e.params, e.body, e.responses]).includes(needle)).slice(0, 30)
  }, [model, name])
  if (!hits.length) return null
  return <div className="mt-3"><H>Used by</H><div className="flex flex-wrap gap-1.5">{hits.map((e) => <span key={e.id} className="mono flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px]"><span className={cn('font-bold uppercase', COLORS[e.method].split(' ').pop())}>{e.method}</span>{e.path}</span>)}</div></div>
}

function Overview({ model }: { model: Model }) {
  const st = stats(model); const md = useMemo(() => toMarkdown(model), [model])
  return (
    <div className="flex flex-col gap-3">
      <Panel title={<>{model.title} {model.apiVersion && <span className="mono font-normal">v{model.apiVersion}</span>}</>} actions={<><CopyButton text={md} label="Copy Markdown" /><DownloadButton text={md} filename="api-reference.md" mime="text/markdown" label="Markdown" /></>}>
        <p className="mono mb-2 text-xs text-muted-foreground">{model.kind === 'swagger2' ? 'Swagger' : 'OpenAPI'} {model.version}</p>
        {model.description && <p className="mb-2 whitespace-pre-wrap text-sm">{model.description}</p>}
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
          {model.contact && <><dt className="text-muted-foreground">Contact</dt><dd>{model.contact}</dd></>}
          {model.license && <><dt className="text-muted-foreground">License</dt><dd>{model.license}</dd></>}
          {model.terms && <><dt className="text-muted-foreground">Terms</dt><dd className="break-all">{model.terms}</dd></>}
        </dl>
      </Panel>
      <Grid cols={4}>
        <Stat label="Endpoints" value={st.endpoints} /><Stat label="Schemas" value={st.schemas} /><Stat label="Tags" value={st.tags} /><Stat label="Deprecated" value={st.deprecated} tone={st.deprecated ? 'warn' : undefined} />
      </Grid>
      <div className="flex flex-wrap gap-1.5">{Object.entries(st.byMethod).map(([m, n]) => <span key={m} className={cn('mono rounded border px-2 py-1 text-xs font-bold uppercase', COLORS[m])}>{m} {n}</span>)}</div>
      <Grid cols={2}>
        <Panel title="Servers">{model.servers.length ? <ul className="flex flex-col gap-1 text-sm">{model.servers.map((s) => <li key={s.url}><span className="mono break-all">{s.url}</span>{s.description && <span className="text-muted-foreground"> — {s.description}</span>}</li>)}</ul> : <p className="text-sm text-muted-foreground">None declared.</p>}</Panel>
        <Panel title="Security schemes">{model.security.length ? <ul className="flex flex-col gap-1 text-sm">{model.security.map((s) => <li key={s.name}><span className="mono font-semibold">{s.name}</span> <span className="text-muted-foreground">{s.type}{s.detail && ` — ${s.detail}`}</span></li>)}</ul> : <p className="text-sm text-muted-foreground">None declared.</p>}</Panel>
      </Grid>
      <Panel title={`Lint (${model.warnings.length})`}>
        {model.warnings.length ? <ul className="flex max-h-72 flex-col gap-1 overflow-auto text-xs">{model.warnings.map((w, i) => <li key={i} className="text-warning">• {w}</li>)}</ul> : <p className="text-sm text-success">No problems found.</p>}
      </Panel>
    </div>
  )
}

type View = 'endpoints' | 'schemas' | 'overview'
export default function SwaggerViewer() {
  const [text, setText] = useState(SAMPLE_SPEC)
  const [view, setView] = useState<View>('endpoints')
  const dt = useDebounced(text, 300)
  const res = useMemo(() => { try { return { model: loadModel(dt), error: '' } } catch (e) { return { model: null, error: (e as Error).message } } }, [dt])
  const m = res.model
  return (
    <div className="flex flex-col gap-3">
      <Notice>Paste or upload an OpenAPI 3.x or Swagger 2.0 document (JSON or YAML). It is parsed in your browser — nothing is uploaded, and no requests are sent to the API.</Notice>
      <div className="grid items-start gap-3 lg:grid-cols-[minmax(300px,2fr)_3fr]">
        <div className="min-w-0 lg:sticky lg:top-3">
          <InputPane title="Spec" value={text} onChange={setText} sample={SAMPLE_SPEC} accept=".json,.yaml,.yml,.txt" rows={28} placeholder={'openapi: 3.0.3\ninfo: …'} />
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={view} onChange={setView} items={[['endpoints', `Endpoints${m ? ` (${m.endpoints.length})` : ''}`], ['schemas', `Schemas${m ? ` (${m.schemas.length})` : ''}`], ['overview', 'Overview']]} />
            {m && <span className="text-xs text-muted-foreground">{m.title}{m.apiVersion && ` · v${m.apiVersion}`}</span>}
          </div>
          {res.error && <Notice kind="error">{res.error}</Notice>}
          {m && view === 'endpoints' && <Endpoints key={m.title + m.endpoints.length} model={m} />}
          {m && view === 'schemas' && <Schemas model={m} />}
          {m && view === 'overview' && <Overview model={m} />}
          {!m && !res.error && <Empty>Nothing to show yet.</Empty>}
        </div>
      </div>
    </div>
  )
}
