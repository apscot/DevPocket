import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Check_, Field, Input, Notice, Panel, Select, Textarea, useDebounced } from '@/components/kit'
import { BACKGROUNDS, THEMES, htmlToLines, renderCodeImage } from '@/lib/codeimg'
import { downloadBlob } from '@/lib/util'

const LANGS: Record<string, () => Promise<{ default: unknown }>> = {
  java: () => import('highlight.js/lib/languages/java'), javascript: () => import('highlight.js/lib/languages/javascript'), typescript: () => import('highlight.js/lib/languages/typescript'), python: () => import('highlight.js/lib/languages/python'),
  json: () => import('highlight.js/lib/languages/json'), yaml: () => import('highlight.js/lib/languages/yaml'), xml: () => import('highlight.js/lib/languages/xml'), sql: () => import('highlight.js/lib/languages/sql'), bash: () => import('highlight.js/lib/languages/bash'),
  css: () => import('highlight.js/lib/languages/css'), go: () => import('highlight.js/lib/languages/go'), rust: () => import('highlight.js/lib/languages/rust'), kotlin: () => import('highlight.js/lib/languages/kotlin'), csharp: () => import('highlight.js/lib/languages/csharp'),
  cpp: () => import('highlight.js/lib/languages/cpp'), dockerfile: () => import('highlight.js/lib/languages/dockerfile'), markdown: () => import('highlight.js/lib/languages/markdown'), plaintext: () => import('highlight.js/lib/languages/plaintext'),
}
const SAMPLE = `@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService service;

    public UserController(UserService service) {
        this.service = service;
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserDto> get(@PathVariable long id) {
        return service.find(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }
}`
export default function CodeScreenshot() {
  const [code, setCode] = useState(SAMPLE); const dc = useDebounced(code, 250)
  const [lang, setLang] = useState('java'); const [theme, setTheme] = useState('midnight'); const [fs, setFs] = useState(14); const [pad, setPad] = useState(48); const [bg, setBg] = useState('teal')
  const [ln, setLn] = useState(true); const [chrome, setChrome] = useState(true); const [title, setTitle] = useState('UserController.java'); const [radius, setRadius] = useState(12)
  const [err, setErr] = useState(''); const [ready, setReady] = useState(false)
  const hostRef = useRef<HTMLDivElement>(null); const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const registered = useRef(new Set<string>())
  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const hljs = (await import('highlight.js/lib/core')).default
        if (!registered.current.has(lang)) { const m = await LANGS[lang](); hljs.registerLanguage(lang, m.default as never); registered.current.add(lang) }
        const html = hljs.highlight(dc, { language: lang, ignoreIllegals: true }).value
        const c = renderCodeImage({ lines: htmlToLines(html), theme: THEMES[theme], fontSize: fs, padding: pad, bgKey: bg, lineNumbers: ln, windowChrome: chrome, title, scale: 2, radius })
        if (!live) return
        canvasRef.current = c; c.style.maxWidth = '100%'; c.style.height = 'auto'; c.style.borderRadius = '6px'
        hostRef.current?.replaceChildren(c); setReady(true); setErr('')
      } catch (e) { if (live) setErr((e as Error).message) }
    })()
    return () => { live = false }
  }, [dc, lang, theme, fs, pad, bg, ln, chrome, title, radius])
  const toBlob = () => new Promise<Blob | null>((r) => canvasRef.current?.toBlob(r, 'image/png'))
  const copy = async () => { const b = await toBlob(); if (b && navigator.clipboard && 'ClipboardItem' in window) { try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]) } catch { setErr('Clipboard image copy is not permitted here — use Download.') } } }
  const lineCount = useMemo(() => code.split('\n').length, [code])
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(300px,1fr)_1.5fr]">
      <div className="flex flex-col gap-3">
        <Panel title="Code" actions={<Button onClick={() => setCode(SAMPLE)}>Sample</Button>}><Textarea aria-label="Code" value={code} onChange={(e) => setCode(e.target.value)} rows={14} className="w-full" /><p className="mt-1 text-[11px] text-muted-foreground">{lineCount} lines</p></Panel>
        <Panel title="Appearance"><div className="grid grid-cols-2 gap-3">
          <Field label="Language"><Select value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Language">{Object.keys(LANGS).map((l) => <option key={l}>{l}</option>)}</Select></Field>
          <Field label="Theme"><Select value={theme} onChange={(e) => setTheme(e.target.value)} aria-label="Theme">{Object.entries(THEMES).map(([k, t]) => <option key={k} value={k}>{t.name}</option>)}</Select></Field>
          <Field label="Background"><Select value={bg} onChange={(e) => setBg(e.target.value)} aria-label="Background">{Object.keys(BACKGROUNDS).map((k) => <option key={k}>{k}</option>)}</Select></Field>
          <Field label="Font size"><Input type="number" min={9} max={32} value={fs} onChange={(e) => setFs(Number(e.target.value) || 14)} aria-label="Font size" /></Field>
          <Field label="Padding"><Input type="number" min={0} max={160} value={pad} onChange={(e) => setPad(Number(e.target.value) || 0)} aria-label="Padding" /></Field>
          <Field label="Corner radius"><Input type="number" min={0} max={40} value={radius} onChange={(e) => setRadius(Number(e.target.value) || 0)} /></Field>
          <Field label="Window title" className="col-span-2"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Check_ label="Line numbers" checked={ln} onChange={setLn} /><Check_ label="Window controls" checked={chrome} onChange={setChrome} />
        </div></Panel>
      </div>
      <Panel title="Preview" actions={<><Button onClick={copy} disabled={!ready}>Copy image</Button><Button variant="default" disabled={!ready} data-testid="download-png" onClick={async () => { const b = await toBlob(); if (b) downloadBlob('code.png', b) }}>Download PNG</Button></>}>
        {err && <Notice kind="error">{err}</Notice>}
        {!ready && <p className="text-sm text-muted-foreground">Rendering…</p>}
        <div ref={hostRef} className="scroll-thin overflow-auto" data-testid="shot" />
        <p className="mt-2 text-[11px] text-muted-foreground">Rendered on a local canvas at 2× resolution. Nothing is uploaded.</p>
      </Panel>
    </div>
  )
}
