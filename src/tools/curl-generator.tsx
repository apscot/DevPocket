import { useMemo, useState } from 'react'
import { Check_, Field, Input, Notice, OutputPane, Panel, Select, Textarea } from '@/components/kit'
import { buildCurl, type CurlOpts } from '@/lib/curl'

const init: CurlOpts = { method: 'POST', url: 'https://api.example.com/v1/users', headers: 'Accept: application/json', body: '{\n  "name": "Ada",\n  "note": "it\'s fine"\n}', bodyType: 'json', auth: 'bearer', user: '', pass: '', token: 'YOUR_TOKEN', authHeader: 'X-API-Key', follow: true, insecure: false, verbose: false, includeHeaders: false, silent: false, compressed: true, timeout: 0, output: '', multiline: true }
export default function CurlGenerator() {
  const [o, setO] = useState<CurlOpts>(init)
  const set = (p: Partial<CurlOpts>) => setO({ ...o, ...p })
  const res = useMemo(() => { try { return { out: buildCurl(o), err: '' } } catch (e) { return { out: '', err: (e as Error).message } } }, [o])
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(320px,1fr)_1fr]">
      <div className="flex flex-col gap-3">
        <Panel title="Request"><div className="grid gap-3">
          <div className="grid grid-cols-[110px_1fr] gap-2"><Field label="Method"><Select value={o.method} onChange={(e) => set({ method: e.target.value })}>{['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map((m) => <option key={m}>{m}</option>)}</Select></Field><Field label="URL"><Input value={o.url} onChange={(e) => set({ url: e.target.value })} aria-label="URL" className="mono" /></Field></div>
          <Field label="Headers (one per line)"><Textarea value={o.headers} onChange={(e) => set({ headers: e.target.value })} rows={3} aria-label="Headers" className="w-full min-h-[70px]" /></Field>
          <Field label="Body"><Select value={o.bodyType} onChange={(e) => set({ bodyType: e.target.value as CurlOpts['bodyType'] })}><option value="none">None</option><option value="json">JSON</option><option value="raw">Raw text</option><option value="form">Form fields (key=value, URL-encoded)</option></Select></Field>
          {o.bodyType !== 'none' && <Textarea value={o.body} onChange={(e) => set({ body: e.target.value })} rows={6} aria-label="Body" className="w-full" />}
        </div></Panel>
        <Panel title="Authentication"><div className="grid gap-3">
          <Select value={o.auth} aria-label="Auth type" onChange={(e) => set({ auth: e.target.value as CurlOpts['auth'] })}><option value="none">None</option><option value="basic">Basic</option><option value="bearer">Bearer token</option><option value="header">API key header</option></Select>
          {o.auth === 'basic' && <div className="grid grid-cols-2 gap-2"><Input placeholder="Username" value={o.user} onChange={(e) => set({ user: e.target.value })} /><Input placeholder="Password" value={o.pass} onChange={(e) => set({ pass: e.target.value })} /></div>}
          {(o.auth === 'bearer' || o.auth === 'header') && <div className="grid grid-cols-2 gap-2">{o.auth === 'header' && <Input placeholder="Header name" value={o.authHeader} onChange={(e) => set({ authHeader: e.target.value })} />}<Input placeholder="Token / key" value={o.token} onChange={(e) => set({ token: e.target.value })} className={o.auth === 'bearer' ? 'col-span-2' : ''} /></div>}
        </div></Panel>
        <Panel title="Options"><div className="flex flex-wrap gap-x-4 gap-y-2"><Check_ label="Follow redirects (-L)" checked={!!o.follow} onChange={(v) => set({ follow: v })} /><Check_ label="Compressed" checked={!!o.compressed} onChange={(v) => set({ compressed: v })} /><Check_ label="Include headers (-i)" checked={!!o.includeHeaders} onChange={(v) => set({ includeHeaders: v })} /><Check_ label="Verbose (-v)" checked={!!o.verbose} onChange={(v) => set({ verbose: v })} /><Check_ label="Silent (-s)" checked={!!o.silent} onChange={(v) => set({ silent: v })} /><Check_ label="HEAD only (-I)" checked={!!o.head} onChange={(v) => set({ head: v })} /><Check_ label="Insecure TLS (-k)" checked={!!o.insecure} onChange={(v) => set({ insecure: v })} /><Check_ label="Multi-line" checked={o.multiline !== false} onChange={(v) => set({ multiline: v })} />
          <Field label="Timeout (s)"><Input type="number" min={0} value={o.timeout} onChange={(e) => set({ timeout: Number(e.target.value) })} className="w-24" /></Field><Field label="Output file"><Input value={o.output} onChange={(e) => set({ output: e.target.value })} className="w-40" placeholder="response.json" /></Field></div></Panel>
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        {res.err && <Notice kind="error">{res.err}</Notice>}
        {o.insecure && <Notice kind="warn">-k disables TLS certificate verification. Use it only against test servers.</Notice>}
        {(o.auth !== 'none') && <Notice kind="warn">The command contains credentials. Avoid committing it or pasting it into shared logs.</Notice>}
        <OutputPane title="cURL command" value={res.out} filename="request.sh" rows={14} />
        <p className="text-xs text-muted-foreground">Values are POSIX shell single-quote escaped (bash/zsh/sh). For PowerShell or cmd.exe, adjust quoting.</p>
      </div>
    </div>
  )
}
