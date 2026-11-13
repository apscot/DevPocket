import { useEffect, useMemo, useRef, useState, useDeferredValue, type ReactNode } from 'react'
import { AlertTriangle, Check, Copy, Download, FileUp, Info, XCircle, CheckCircle2, Search, Trash2, Wand2 } from 'lucide-react'
import { Button } from './ui/button'
import { Input, Select, Textarea } from './ui/inputs'
import { cn } from '@/lib/cn'
import { copyText, downloadText, byteLength, fmtBytes } from '@/lib/util'

export { Button, Input, Select, Textarea }

export function Panel({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('flex min-w-0 flex-col rounded-lg border bg-card', className)}>
      {(title || actions) && (
        <header className="flex min-h-11 flex-wrap items-center gap-2 border-b px-3 py-1.5">
          <h2 className="text-[13px] font-semibold text-muted-foreground">{title}</h2>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">{actions}</div>
        </header>
      )}
      <div className="min-w-0 flex-1 p-3">{children}</div>
    </section>
  )
}

export function CopyButton({ text, label = 'Copy', size = 'sm', className }: { text: string | (() => string); label?: string; size?: 'sm' | 'icon'; className?: string }) {
  const [ok, setOk] = useState(false)
  return (
    <Button size={size} className={className} aria-label={label} onClick={async () => { if (await copyText(typeof text === 'function' ? text() : text)) { setOk(true); setTimeout(() => setOk(false), 1200) } }}>
      {ok ? <Check size={14} className="text-success" /> : <Copy size={14} />}{size !== 'icon' && (ok ? 'Copied' : label)}
    </Button>
  )
}
export function DownloadButton({ text, filename, mime, label = 'Download', disabled }: { text: string; filename: string; mime?: string; label?: string; disabled?: boolean }) {
  return <Button disabled={disabled} onClick={() => downloadText(filename, text, mime)}><Download size={14} />{label}</Button>
}

export type NoticeKind = 'error' | 'warn' | 'info' | 'success'
export function Notice({ kind = 'info', children, className }: { kind?: NoticeKind; children: ReactNode; className?: string }) {
  const m = { error: [XCircle, 'border-destructive/40 bg-destructive/5 text-destructive'], warn: [AlertTriangle, 'border-warning/40 bg-warning/5 text-warning'], info: [Info, 'border-primary/30 bg-accent text-foreground'], success: [CheckCircle2, 'border-success/40 bg-success/5 text-success'] }[kind] as [typeof Info, string]
  const I = m[0]
  return <div role={kind === 'error' ? 'alert' : 'status'} className={cn('flex gap-2 rounded-md border px-3 py-2 text-[13px]', m[1], className)}><I size={15} className="mt-0.5 shrink-0" /><div className="min-w-0 whitespace-pre-wrap break-words">{children}</div></div>
}
export const Empty = ({ children }: { children: ReactNode }) => <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{children}</p>

export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn('flex min-w-0 flex-col gap-1', className)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  )
}
export const Check_ = ({ label, checked, onChange }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void }) => (
  <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />{label}</label>
)
export { Check_ as Checkbox }
export const Stat = ({ label, value, tone }: { label: string; value: ReactNode; tone?: 'ok' | 'bad' | 'warn' }) => (
  <div className="rounded-md border bg-background px-3 py-2"><div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div><div className={cn('mono text-base font-semibold', tone === 'ok' && 'text-success', tone === 'bad' && 'text-destructive', tone === 'warn' && 'text-warning')}>{value}</div></div>
)
export const Grid = ({ cols = 2, children, className }: { cols?: 1 | 2 | 3 | 4; children: ReactNode; className?: string }) => (
  <div className={cn('grid gap-3', cols === 2 && 'lg:grid-cols-2', cols === 3 && 'md:grid-cols-2 lg:grid-cols-3', cols === 4 && 'sm:grid-cols-2 lg:grid-cols-4', className)}>{children}</div>
)
export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: [T, string][] }) {
  return (
    <div role="tablist" className="inline-flex flex-wrap rounded-md border bg-muted p-0.5">
      {items.map(([k, l]) => <button key={k} role="tab" aria-selected={value === k} onClick={() => onChange(k)} className={cn('cursor-pointer rounded px-3 py-1 text-[13px]', value === k ? 'bg-card font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground')}>{l}</button>)}
    </div>
  )
}
export const SearchBox = ({ value, onChange, placeholder = 'Search…', className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) => (
  <div className={cn('relative', className)}><Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="pl-8" /></div>
)

/** Highlight occurrences of `q` (case-insensitive) inside text. */
export function Hl({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>
  const parts: ReactNode[] = []; const lo = text.toLowerCase(), ql = q.toLowerCase(); let i = 0, k = 0
  for (;;) { const j = lo.indexOf(ql, i); if (j < 0) break; if (j > i) parts.push(text.slice(i, j)); parts.push(<mark key={k++} className="hl">{text.slice(j, j + q.length)}</mark>); i = j + q.length }
  parts.push(text.slice(i)); return <>{parts}</>
}

export function FileButton({ onText, accept, label = 'Upload', onFile }: { onText?: (text: string, name: string) => void; accept?: string; label?: string; onFile?: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <input ref={ref} type="file" accept={accept} hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) { onFile?.(f); if (onText) onText(await f.text(), f.name) } e.target.value = '' }} />
      <Button onClick={() => ref.current?.click()}><FileUp size={14} />{label}</Button>
    </>
  )
}

export function InputPane({ title = 'Input', value, onChange, placeholder, sample, accept, rows = 14, extra, className }: { title?: string; value: string; onChange: (v: string) => void; placeholder?: string; sample?: string; accept?: string; rows?: number; extra?: ReactNode; className?: string }) {
  return (
    <Panel className={className} title={title} actions={<>
      {extra}
      {sample != null && <Button onClick={() => onChange(sample)}><Wand2 size={14} />Sample</Button>}
      <FileButton accept={accept} onText={(t) => onChange(t)} />
      <Button onClick={() => onChange('')} disabled={!value} aria-label="Clear input"><Trash2 size={14} />Clear</Button>
    </>}>
      <Textarea aria-label={title} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} className="w-full" />
      <p className="mt-1.5 text-[11px] text-muted-foreground">{value.length.toLocaleString()} chars · {fmtBytes(byteLength(value))}</p>
    </Panel>
  )
}

export function OutputPane({ title = 'Output', value, filename, mime, rows = 14, actions, children, className }: { title?: string; value: string; filename?: string; mime?: string; rows?: number; actions?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <Panel className={className} title={title} actions={<>{actions}<CopyButton text={value} />{filename && <DownloadButton text={value} filename={filename} mime={mime} disabled={!value} />}</>}>
      {children ?? <Textarea readOnly aria-label={title} value={value} rows={rows} className="w-full bg-muted/40" />}
      {value && <p className="mt-1.5 text-[11px] text-muted-foreground">{value.length.toLocaleString()} chars · {fmtBytes(byteLength(value))}</p>}
    </Panel>
  )
}

export function useDebounced<T>(v: T, ms = 200): T {
  const [d, setD] = useState(v)
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t) }, [v, ms])
  return d
}
export function useSessionText(initial = '') { return useState(initial) }

// ---------- Declarative options ----------
export type OptVal = string | number | boolean
export interface OptDef {
  key: string; label: string; type: 'select' | 'number' | 'check' | 'text'
  options?: [string, string][]; default: OptVal; min?: number; max?: number; hint?: string
  show?: (o: Record<string, any>) => boolean
}
export function Options({ defs, values, onChange }: { defs: OptDef[]; values: Record<string, any>; onChange: (v: Record<string, any>) => void }) {
  const set = (k: string, v: OptVal) => onChange({ ...values, [k]: v })
  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-2.5">
      {defs.filter((d) => !d.show || d.show(values)).map((d) => {
        if (d.type === 'check') return <Check_ key={d.key} label={d.label} checked={!!values[d.key]} onChange={(v) => set(d.key, v)} />
        return (
          <Field key={d.key} label={d.label} hint={d.hint} className="min-w-[110px]">
            {d.type === 'select' ? <Select value={String(values[d.key])} onChange={(e) => set(d.key, e.target.value)}>{d.options!.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
              : d.type === 'number' ? <Input type="number" min={d.min} max={d.max} value={values[d.key]} onChange={(e) => set(d.key, e.target.value === '' ? 0 : Number(e.target.value))} className="w-24" />
                : <Input value={String(values[d.key])} onChange={(e) => set(d.key, e.target.value)} className="w-40" />}
          </Field>
        )
      })}
    </div>
  )
}
export const defaultsOf = (defs: OptDef[]) => Object.fromEntries(defs.map((d) => [d.key, d.default]))

// ---------- Transform tool ----------
export interface TransformConfig {
  inputTitle?: string; placeholder?: string; sample?: string; accept?: string
  options?: OptDef[]
  run: (input: string, opts: Record<string, any>) => string | Promise<string>
  outputTitle?: string; filename?: string | ((o: Record<string, any>) => string); mime?: string
  notice?: { kind: NoticeKind; text: string }
  emptyHint?: string
  extra?: (input: string, output: string, opts: Record<string, any>) => ReactNode
  stacked?: boolean
  success?: (output: string, input: string, opts: Record<string, any>) => string | null
  /** Render output differently (e.g. highlighted) */
  render?: (output: string, opts: Record<string, any>) => ReactNode
}
export function TransformTool(cfg: TransformConfig) {
  const defs = cfg.options ?? []
  const [input, setInput] = useState('')
  const [opts, setOpts] = useState<Record<string, any>>(() => defaultsOf(defs))
  const deferred = useDeferredValue(input)
  const [state, setState] = useState<{ out: string; err: string | null }>({ out: '', err: null })
  useEffect(() => {
    let live = true
    if (!deferred.trim()) { setState({ out: '', err: null }); return }
    ;(async () => {
      try { const out = await cfg.run(deferred, opts); if (live) setState({ out, err: null }) }
      catch (e) { if (live) setState({ out: '', err: e instanceof Error ? e.message : String(e) }) }
    })()
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferred, opts])
  const fname = typeof cfg.filename === 'function' ? cfg.filename(opts) : cfg.filename
  const ok = !state.err && state.out && cfg.success?.(state.out, input, opts)
  return (
    <div className="flex flex-col gap-3">
      {cfg.notice && <Notice kind={cfg.notice.kind}>{cfg.notice.text}</Notice>}
      {defs.length > 0 && <Panel title="Options"><Options defs={defs} values={opts} onChange={setOpts} /></Panel>}
      <div className={cn('grid gap-3', !cfg.stacked && 'lg:grid-cols-2')}>
        <InputPane title={cfg.inputTitle ?? 'Input'} value={input} onChange={setInput} placeholder={cfg.placeholder} sample={cfg.sample} accept={cfg.accept} />
        <div className="flex min-w-0 flex-col gap-3">
          {state.err && <Notice kind="error">{state.err}</Notice>}
          {ok && <Notice kind="success">{ok}</Notice>}
          <OutputPane title={cfg.outputTitle ?? 'Output'} value={state.out} filename={fname} mime={cfg.mime}>
            {!input.trim() ? <Empty>{cfg.emptyHint ?? 'Paste or upload input to see the result here.'}</Empty> : cfg.render && state.out ? cfg.render(state.out, opts) : undefined}
          </OutputPane>
          {cfg.extra?.(input, state.out, opts)}
        </div>
      </div>
    </div>
  )
}

// ---------- Command builder ----------
export interface CmdField { key: string; label: string; type?: 'text' | 'select' | 'check' | 'number'; options?: [string, string][]; default?: OptVal; placeholder?: string }
export interface Recipe { id: string; label: string; category?: string; desc: string; danger?: string; fields: CmdField[]; build: (v: Record<string, any>) => string }
export function CommandBuilder({ recipes, searchable, notice }: { recipes: Recipe[]; searchable?: boolean; notice?: string }) {
  const [sel, setSel] = useState(recipes[0].id)
  const [vals, setVals] = useState<Record<string, Record<string, any>>>({})
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const cats = useMemo(() => [...new Set(recipes.map((r) => r.category).filter(Boolean))] as string[], [recipes])
  const list = recipes.filter((r) => (!cat || r.category === cat) && (!q || (r.label + r.desc + r.build(Object.fromEntries(r.fields.map((f) => [f.key, f.default ?? ''])))).toLowerCase().includes(q.toLowerCase())))
  const r = recipes.find((x) => x.id === sel) ?? recipes[0]
  const v = { ...Object.fromEntries(r.fields.map((f) => [f.key, f.default ?? (f.type === 'check' ? false : '')])), ...(vals[r.id] ?? {}) }
  const cmd = r.build(v)
  return (
    <div className="flex flex-col gap-3">
      {notice && <Notice kind="info">{notice}</Notice>}
      <div className="grid gap-3 lg:grid-cols-[280px_1fr]">
        <Panel title="Commands">
          {(searchable || cats.length > 0) && (
            <div className="mb-2 flex flex-col gap-2">
              {searchable && <SearchBox value={q} onChange={setQ} placeholder="Search commands…" />}
              {cats.length > 0 && <Select aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All categories</option>{cats.map((c) => <option key={c}>{c}</option>)}</Select>}
            </div>
          )}
          <ul className="max-h-[480px] overflow-auto scroll-thin">
            {list.map((x) => <li key={x.id}><button onClick={() => setSel(x.id)} className={cn('w-full cursor-pointer rounded px-2 py-1.5 text-left text-sm', x.id === r.id ? 'bg-accent font-medium text-primary' : 'hover:bg-muted')}>{x.label}{x.danger && <AlertTriangle size={12} className="ml-1 inline text-warning" />}</button></li>)}
            {!list.length && <li className="p-3 text-sm text-muted-foreground">No commands match.</li>}
          </ul>
        </Panel>
        <div className="flex min-w-0 flex-col gap-3">
          <Panel title={r.label}>
            <p className="mb-3 text-sm text-muted-foreground">{r.desc}</p>
            {r.fields.length > 0 && <div className="grid gap-3 sm:grid-cols-2">
              {r.fields.map((f) => f.type === 'check'
                ? <Check_ key={f.key} label={f.label} checked={!!v[f.key]} onChange={(c) => setVals({ ...vals, [r.id]: { ...v, [f.key]: c } })} />
                : <Field key={f.key} label={f.label}>
                  {f.type === 'select' ? <Select value={String(v[f.key])} onChange={(e) => setVals({ ...vals, [r.id]: { ...v, [f.key]: e.target.value } })}>{f.options!.map(([a, b]) => <option key={a} value={a}>{b}</option>)}</Select>
                    : <Input type={f.type === 'number' ? 'number' : 'text'} value={String(v[f.key])} placeholder={f.placeholder} onChange={(e) => setVals({ ...vals, [r.id]: { ...v, [f.key]: e.target.value } })} />}
                </Field>)}
            </div>}
          </Panel>
          {r.danger && <Notice kind="warn"><b>Destructive: </b>{r.danger}</Notice>}
          <OutputPane title="Command" value={cmd} rows={Math.min(10, cmd.split('\n').length + 1)} />
        </div>
      </div>
    </div>
  )
}

export { shq } from '@/lib/util'
