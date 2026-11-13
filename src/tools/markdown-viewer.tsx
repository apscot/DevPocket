import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FileDown, FileText, Minus, Plus, Printer, RotateCcw, X } from 'lucide-react'
import { Button, Checkbox, CopyButton, FileButton, Notice, Panel, Select, Tabs, Textarea } from '@/components/kit'
import { downloadBlob, downloadText, copyText } from '@/lib/util'
import {
  DOC_CSS, buildWordMhtml, docTitle, fileSlug, inlineDiagrams, normalizeSvg, renderMarkdown, standaloneHtml, svgSize, toAzureWiki, withToc, wordImgTag,
  type PageSize, type WordImage,
} from '@/lib/mdviewer'
import { svgToPng } from '@/lib/raster'

const SAMPLE = `# Payment Service — Design Notes

[[_TOC_]]

## Overview
The **payment service** validates orders, charges the customer and publishes an event.
It is documented here with *diagrams as code* so the docs live next to the source.

- [x] Architecture diagram
- [x] Request flow
- [ ] Capacity plan

## Architecture
\`\`\`mermaid
flowchart LR
  Client([Client]) -->|HTTPS| GW[API Gateway]
  GW --> Auth{Token valid?}
  Auth -->|yes| Pay[Payment Service]
  Auth -->|no| Deny[401 Unauthorized]
  Pay --> DB[(Postgres)]
  Pay --> Bus[[Kafka: payments.v1]]
  Bus --> Mail[Notification Service]
\`\`\`

## Request flow
\`\`\`mermaid
sequenceDiagram
  autonumber
  participant U as User
  participant G as Gateway
  participant P as Payments
  participant B as Bank
  U->>G: POST /payments
  G->>P: validate + forward
  P->>B: charge(amount)
  alt approved
    B-->>P: 200 OK
    P-->>U: 201 Created
  else declined
    B-->>P: 402
    P-->>U: 402 Payment Required
  end
\`\`\`

## Data model
\`\`\`mermaid
erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ PAYMENT : "paid by"
  CUSTOMER { int id string email }
  PAYMENT { int id decimal amount string status }
\`\`\`

## Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | \`/payments\` | Create a payment |
| GET | \`/payments/{id}\` | Fetch a payment |

\`\`\`java
@PostMapping("/payments")
public ResponseEntity<Payment> create(@Valid @RequestBody PaymentRequest req) {
    return ResponseEntity.status(201).body(service.charge(req));
}
\`\`\`

> Tip: export this page to an Azure DevOps wiki, Word or PDF from the toolbar.
`

const THEMES: [string, string, string][] = [['default', 'Default', '#ffffff'], ['neutral', 'Neutral (print friendly)', '#ffffff'], ['forest', 'Forest', '#ffffff'], ['base', 'Base', '#ffffff'], ['dark', 'Dark', '#1e1e1e']]
const bgOf = (t: string) => THEMES.find((x) => x[0] === t)?.[2] ?? '#ffffff'

type Result = { svg: string; bg: string } | { error: string; code: string }

const PREVIEW_CSS = `${DOC_CSS}
.mdv-paper{background:#fff;color:#1f2328;border:1px solid var(--border);border-radius:8px;padding:28px 32px;box-shadow:0 1px 2px rgb(0 0 0/.06)}
.mdv-paper .mdv{max-width:none}
.mmd-fig{border:1px solid #d8dee4;border-radius:8px;margin:1.2em 0;padding:10px 12px 14px;text-align:center;overflow:auto}
.mmd-fig svg{max-width:100%;height:auto}
.mmd-tools{display:flex;gap:4px;justify-content:flex-end;margin-bottom:6px;font-family:ui-sans-serif,system-ui,sans-serif}
.mmd-tools button{cursor:pointer;border:1px solid #d0d7de;background:#fff;color:#24292f;border-radius:6px;font-size:12px;padding:2px 9px;line-height:1.6}
.mmd-tools button:hover{background:#f3f4f6}
.mmd-load{color:#6e7781;font-size:13px;padding:24px}
.mmd-err{text-align:left;border:1px solid #cf222e;background:#fff5f5;border-radius:6px;padding:.6em 1em;margin:1.2em 0;color:#82071e}
.mmd-err b{display:block;margin-bottom:.3em}.mmd-err pre{background:#fff;margin:.4em 0 0;max-height:220px}
`

let seq = 0
export default function MarkdownViewer() {
  const [md, setMd] = useState(SAMPLE)
  const [view, setView] = useState<'split' | 'edit' | 'preview'>('split')
  const [theme, setTheme] = useState('default')
  const [toc, setToc] = useState(false)
  const [size, setSize] = useState<PageSize>('A4')
  const [scale, setScale] = useState('3')
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)
  const [modal, setModal] = useState<{ svg: string; bg: string; i: number } | null>(null)
  const [hl, setHl] = useState<((code: string, lang: string) => string | null) | null>(null)
  const host = useRef<HTMLDivElement>(null)
  const cache = useRef(new Map<string, Result>())
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const results = useRef<Result[]>([])

  useEffect(() => {
    import('highlight.js/lib/common').then((m) => { const h = m.default; setHl(() => (code: string, lang: string) => (h.getLanguage(lang) ? h.highlight(code, { language: lang, ignoreIllegals: true }).value : null)) })
  }, [])

  const text = toc ? withToc(md) : md
  const rendered = useMemo(() => renderMarkdown(text, hl ?? undefined), [text, hl])

  const renderOne = useCallback((code: string): Promise<Result> => {
    const key = `${theme}\u0000${code}`; const hit = cache.current.get(key); if (hit) return Promise.resolve(hit)
    const job = queue.current.then(async (): Promise<Result> => {
      const mermaid = (await import('mermaid')).default
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: theme as 'default', htmlLabels: false, flowchart: { htmlLabels: false, useMaxWidth: true }, suppressErrorRendering: true, fontFamily: '"Segoe UI", Arial, sans-serif' })
      const id = `mdv-${++seq}`
      try {
        await mermaid.parse(code)
        const { svg } = await mermaid.render(id, code)
        return { svg, bg: bgOf(theme) }
      } catch (e) {
        document.getElementById(id)?.remove(); document.getElementById(`d${id}`)?.remove()
        return { error: (e as Error).message.replace(/<[^>]+>/g, '').split('\n').slice(0, 6).join('\n'), code }
      }
    }).then((r) => { cache.current.set(key, r); return r })
    queue.current = job.catch(() => undefined)
    return job
  }, [theme])

  const getResults = useCallback(async () => Promise.all(rendered.diagrams.map(renderOne)), [rendered, renderOne])

  // paint preview + diagrams
  useEffect(() => {
    const el = host.current; if (!el) return
    el.innerHTML = rendered.html
    const slots = [...el.querySelectorAll<HTMLElement>('.mmd')]
    slots.forEach((s) => { s.innerHTML = '<div class="mmd-load">Rendering diagram…</div>' })
    let live = true
    ;(async () => {
      const out: Result[] = []
      for (let i = 0; i < slots.length; i++) {
        const r = await renderOne(rendered.diagrams[i]); if (!live) return
        out.push(r)
        const s = slots[i]
        if ('error' in r) {
          s.innerHTML = `<div class="mmd-err" role="alert"><b>Diagram ${i + 1} could not be rendered</b><span style="white-space:pre-wrap"></span><pre><code></code></pre></div>`
          s.querySelector('span')!.textContent = r.error; s.querySelector('code')!.textContent = r.code
        }
        else s.innerHTML = `<figure class="mmd-fig" data-testid="mermaid-diagram" style="background:${r.bg};margin:1.2em 0"><div class="mmd-tools"><button data-act="expand" data-i="${i}">Expand</button><button data-act="svg" data-i="${i}">SVG</button><button data-act="png" data-i="${i}">PNG</button><button data-act="copy" data-i="${i}">Copy SVG</button></div>${normalizeSvg(r.svg)}</figure>`
      }
      results.current = out
    })()
    return () => { live = false }
  }, [rendered, renderOne, view])

  const onPreviewClick = async (e: React.MouseEvent) => {
    const t = e.target as HTMLElement
    const btn = t.closest<HTMLButtonElement>('button[data-act]')
    if (btn) {
      const i = Number(btn.dataset.i); const r = results.current[i]; if (!r || 'error' in r) return
      const name = `diagram-${i + 1}`
      if (btn.dataset.act === 'expand') setModal({ svg: r.svg, bg: r.bg, i })
      else if (btn.dataset.act === 'svg') downloadText(`${name}.svg`, normalizeSvg(r.svg), 'image/svg+xml')
      else if (btn.dataset.act === 'copy') { await copyText(normalizeSvg(r.svg)); btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = 'Copy SVG' }, 1200) }
      else if (btn.dataset.act === 'png') { try { downloadBlob(`${name}.png`, (await svgToPng(r.svg, Number(scale), r.bg)).blob) } catch (er) { setMsg({ kind: 'error', text: (er as Error).message }) } }
      return
    }
    const a = t.closest('a'); const href = a?.getAttribute('href')
    if (a && href) {
      e.preventDefault()
      if (href.startsWith('#')) host.current?.querySelector(`[id="${CSS.escape(decodeURIComponent(href.slice(1)))}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      else if (/^(https?:|mailto:)/i.test(href)) window.open(href, '_blank', 'noopener,noreferrer')
    }
  }

  const base = fileSlug(docTitle(md))
  const title = docTitle(md)
  const run = async (label: string, fn: () => Promise<string | void>) => {
    setBusy(label); setMsg(null)
    try { const r = await fn(); if (r) setMsg({ kind: 'success', text: r }) } catch (e) { setMsg({ kind: 'error', text: (e as Error).message }) } finally { setBusy('') }
  }
  const bodyHtml = async () => inlineDiagrams(rendered.html, await getResults())
  const failed = (rs: Result[]) => rs.filter((r) => 'error' in r).length

  const exportAzure = () => { downloadText(`${base}.md`, toAzureWiki(md, { toc }), 'text/markdown'); setMsg({ kind: 'success', text: 'Azure DevOps wiki page downloaded: mermaid fences were converted to ::: mermaid blocks.' }) }
  const exportHtml = () => run('html', async () => { const body = await bodyHtml(); downloadText(`${base}.html`, standaloneHtml(title, body, { size }), 'text/html'); return 'Standalone HTML downloaded (diagrams are embedded as vector SVG).' })
  const exportPdf = () => run('pdf', async () => {
    const rs = await getResults(); const html = standaloneHtml(title, inlineDiagrams(rendered.html, rs), { size })
    const f = document.createElement('iframe'); f.setAttribute('aria-hidden', 'true'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
    f.onload = () => setTimeout(() => { f.contentWindow?.focus(); f.contentWindow?.print(); setTimeout(() => f.remove(), 120000) }, 250)
    f.srcdoc = html; document.body.appendChild(f)
    return `The print dialog opened: choose “Save as PDF”. Diagrams stay sharp vector graphics${failed(rs) ? ` (${failed(rs)} failed diagram(s) are shown as error boxes)` : ''}.`
  })
  const exportWord = () => run('word', async () => {
    const rs = await getResults(); const images: WordImage[] = []; const tags: (string | null)[] = []
    for (let i = 0; i < rs.length; i++) {
      const r = rs[i]; if ('error' in r) { tags.push(null); continue }
      const { blob, w, h } = await svgToPng(r.svg, Number(scale), r.bg)
      const name = `diagram-${i + 1}.png`; images.push({ name, mime: 'image/png', data: new Uint8Array(await blob.arrayBuffer()), w, h }); tags.push(wordImgTag(name, w, h, `Diagram ${i + 1}`))
    }
    const body = inlineDiagrams(rendered.html, rs, (i) => tags[i])
    downloadBlob(`${base}.doc`, new Blob([buildWordMhtml(title, body, images, size)], { type: 'application/msword' }))
    return `Word document downloaded with ${images.length} diagram image(s) at ${scale}× resolution.`
  })

  return (
    <div className="flex flex-col gap-3">
      <style>{PREVIEW_CSS}</style>
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={view} onChange={setView} items={[['split', 'Split'], ['edit', 'Editor'], ['preview', 'Preview']]} />
        <FileButton accept=".md,.markdown,.txt" onText={setMd} />
        <Select aria-label="Diagram theme" value={theme} onChange={(e) => setTheme(e.target.value)} className="h-8 w-64">{THEMES.map(([k, l]) => <option key={k} value={k}>Diagram theme: {l}</option>)}</Select>
        <Checkbox label="Table of contents" checked={toc} onChange={setToc} />
      </div>
      <Panel title="Export" actions={<div className="flex flex-wrap items-center gap-2 text-[13px]">
        <Select aria-label="Page size" value={size} onChange={(e) => setSize(e.target.value as PageSize)} className="h-8 w-28"><option value="A4">A4</option><option value="Letter">Letter</option></Select>
        <Select aria-label="Diagram image scale" value={scale} onChange={(e) => setScale(e.target.value)} className="h-8 w-32"><option value="2">PNG 2×</option><option value="3">PNG 3×</option><option value="4">PNG 4×</option></Select>
      </div>}>
        <div className="flex flex-wrap gap-2">
          <Button variant="default" onClick={exportAzure}><FileDown size={14} />Azure DevOps Wiki (.md)</Button>
          <CopyButton text={() => toAzureWiki(md, { toc })} label="Copy for Azure Wiki" />
          <Button variant="default" disabled={!!busy} onClick={exportWord}><FileText size={14} />{busy === 'word' ? 'Building…' : 'Word (.doc)'}</Button>
          <Button variant="default" disabled={!!busy} onClick={exportPdf}><Printer size={14} />{busy === 'pdf' ? 'Preparing…' : 'PDF (print)'}</Button>
          <Button disabled={!!busy} onClick={exportHtml}><FileDown size={14} />HTML</Button>
          <Button onClick={() => downloadText(`${base}.md`, md, 'text/markdown')}><FileDown size={14} />Markdown</Button>
        </div>
        {msg && <Notice kind={msg.kind} className="mt-2">{msg.text}</Notice>}
      </Panel>
      <div className={view === 'split' ? 'grid items-start gap-3 lg:grid-cols-2' : ''}>
        {view !== 'preview' && <Panel title="Markdown"><Textarea aria-label="Markdown" value={md} onChange={(e) => setMd(e.target.value)} rows={view === 'edit' ? 30 : 34} className="w-full" spellCheck={false} /></Panel>}
        {view !== 'edit' && <div className="min-w-0"><div className="mdv-paper"><div ref={host} className="mdv" data-testid="md-preview" onClick={onPreviewClick} /></div></div>}
      </div>
      <Notice kind="info">
        Everything runs in your browser. Mermaid blocks (<span className="mono">```mermaid</span> or Azure’s <span className="mono">::: mermaid</span>) render in strict mode. <b>Azure DevOps</b>: fences become <span className="mono">::: mermaid</span> blocks, so paste the file into a wiki page. <b>Word</b>: saved as a Word-compatible .doc with diagrams as PNG images. <b>PDF</b>: uses your browser’s print dialog (vector diagrams, selectable text).
      </Notice>
      {modal && <DiagramModal {...modal} scale={Number(scale)} onClose={() => setModal(null)} />}
    </div>
  )
}

function DiagramModal({ svg, bg, i, scale, onClose }: { svg: string; bg: string; i: number; scale: number; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null)
  const { w, h } = svgSize(svg)
  const [v, setV] = useState({ k: 1, x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number } | null>(null)
  const fit = useCallback(() => { const r = box.current?.getBoundingClientRect(); if (!r) return; const k = Math.min(r.width / (w + 40), r.height / (h + 40), 3); setV({ k, x: (r.width - w * k) / 2, y: (r.height - h * k) / 2 }) }, [w, h])
  useEffect(() => { fit() }, [fit])
  useEffect(() => {
    const el = box.current; if (!el) return
    const wheel = (e: WheelEvent) => { e.preventDefault(); const r = el.getBoundingClientRect(); const mx = e.clientX - r.left, my = e.clientY - r.top; setV((s) => { const k = Math.min(8, Math.max(0.1, s.k * (e.deltaY < 0 ? 1.15 : 1 / 1.15))); return { k, x: mx - ((mx - s.x) / s.k) * k, y: my - ((my - s.y) / s.k) * k } }) }
    el.addEventListener('wheel', wheel, { passive: false })
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', key)
    return () => { el.removeEventListener('wheel', wheel); window.removeEventListener('keydown', key) }
  }, [onClose])
  const zoom = (f: number) => { const r = box.current!.getBoundingClientRect(); setV((s) => { const k = Math.min(8, Math.max(0.1, s.k * f)); const mx = r.width / 2, my = r.height / 2; return { k, x: mx - ((mx - s.x) / s.k) * k, y: my - ((my - s.y) / s.k) * k } }) }
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/70 p-4" role="dialog" aria-modal="true" aria-label={`Diagram ${i + 1}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2 rounded-md border bg-card p-2">
        <b className="text-sm">Diagram {i + 1}</b>
        <Button size="icon" aria-label="Zoom in" onClick={() => zoom(1.25)}><Plus size={15} /></Button>
        <Button size="icon" aria-label="Zoom out" onClick={() => zoom(1 / 1.25)}><Minus size={15} /></Button>
        <Button size="icon" aria-label="Fit to screen" onClick={fit}><RotateCcw size={15} /></Button>
        <span className="text-xs text-muted-foreground">{Math.round(v.k * 100)}% · drag to pan · scroll to zoom</span>
        <div className="ml-auto flex gap-1.5">
          <Button onClick={() => downloadText(`diagram-${i + 1}.svg`, normalizeSvg(svg), 'image/svg+xml')}>SVG</Button>
          <Button onClick={async () => downloadBlob(`diagram-${i + 1}.png`, (await svgToPng(svg, scale, bg)).blob)}>PNG</Button>
          <Button variant="default" onClick={onClose}><X size={14} />Close</Button>
        </div>
      </div>
      <div ref={box} data-testid="diagram-modal" className="relative flex-1 cursor-grab overflow-hidden rounded-md border" style={{ background: bg, touchAction: 'none' }}
        onPointerDown={(e) => { drag.current = { x: e.clientX - v.x, y: e.clientY - v.y }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) }}
        onPointerMove={(e) => { const d = drag.current; if (d) setV((s) => ({ ...s, x: e.clientX - d.x, y: e.clientY - d.y })) }}
        onPointerUp={() => { drag.current = null }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, transformOrigin: '0 0', transform: `translate(${v.x}px,${v.y}px) scale(${v.k})` }} dangerouslySetInnerHTML={{ __html: normalizeSvg(svg) }} />
      </div>
    </div>
  )
}
