import { useEffect, useMemo, useState } from 'react'
import { Button, Check_, CopyButton, DownloadButton, Empty, FileButton, Grid, Notice, Panel, Select, Stat, Textarea } from '@/components/kit'
import { sanitizeSvg, inspectSvg } from '@/lib/svg'

const SAMPLE = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="140" viewBox="0 0 240 140">
  <rect width="240" height="140" rx="14" fill="#0f766e"/>
  <circle cx="70" cy="70" r="34" fill="#fff" opacity=".9"/>
  <path d="M120 50h80M120 70h60M120 90h70" stroke="#fff" stroke-width="8" stroke-linecap="round"/>
  <script>alert('xss')</script>
  <rect width="10" height="10" onclick="alert(1)"/>
</svg>`
export default function SvgEditor() {
  const [src, setSrc] = useState(''); const [bg, setBg] = useState('checker'); const [zoom, setZoom] = useState(1); const [showRaw, setShowRaw] = useState(false)
  const s = useMemo(() => (src.trim() ? sanitizeSvg(src) : null), [src])
  const info = useMemo(() => (s && !s.error ? inspectSvg(s.clean) : null), [s])
  const [url, setUrl] = useState('')
  useEffect(() => { if (!s || s.error) { setUrl(''); return } const u = URL.createObjectURL(new Blob([s.clean], { type: 'image/svg+xml' })); setUrl(u); return () => URL.revokeObjectURL(u) }, [s])
  const bgStyle: React.CSSProperties = bg === 'checker' ? { backgroundImage: 'conic-gradient(#8884 25%, transparent 0 50%, #8884 0 75%, transparent 0)', backgroundSize: '16px 16px' } : { background: bg === 'white' ? '#fff' : bg === 'black' ? '#000' : 'transparent' }
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="SVG source" actions={<><Button onClick={() => setSrc(SAMPLE)}>Sample</Button><FileButton accept=".svg,image/svg+xml" onText={setSrc} /></>}><Textarea aria-label="SVG source" value={src} onChange={(e) => setSrc(e.target.value)} rows={18} className="w-full" placeholder="Paste or upload SVG markup…" /></Panel>
        <Panel title="Preview (sanitized)" actions={<><Select aria-label="Background" value={bg} onChange={(e) => setBg(e.target.value)} className="h-8 w-28"><option value="checker">Checker</option><option value="white">White</option><option value="black">Black</option><option value="none">None</option></Select><Select aria-label="Zoom" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="h-8 w-24">{[0.5, 1, 2, 4].map((z) => <option key={z} value={z}>{z * 100}%</option>)}</Select></>}>
          {!s ? <Empty>Paste SVG to preview it. Scripts, event handlers and external references are stripped before rendering.</Empty> : s.error ? <Notice kind="error">{s.error}</Notice> : <div className="scroll-thin flex min-h-[260px] items-center justify-center overflow-auto rounded-md border p-4" style={bgStyle}><img src={url} alt="SVG preview" style={{ transform: `scale(${zoom})`, transformOrigin: 'center', maxWidth: zoom === 1 ? '100%' : undefined }} data-testid="svg-preview" /></div>}
        </Panel>
      </div>
      {s && !s.error && (<>
        {s.removed.length > 0 && <Notice kind="warn">Sanitizer removed unsafe content: {s.removed.join(', ')}. Preview and downloads use the cleaned version.</Notice>}
        {info && <Grid cols={4}><Stat label="Width" value={info.width ?? '—'} /><Stat label="Height" value={info.height ?? '—'} /><Stat label="viewBox" value={<span className="text-sm">{info.viewBox ?? '—'}</span>} /><Stat label="Elements" value={info.elements} /></Grid>}
        {info && info.tags.length > 0 && <Panel title="Element counts"><div className="flex flex-wrap gap-1.5">{info.tags.map(([t, n]) => <span key={t} className="mono rounded border px-2 py-0.5 text-xs">{t} ×{n}</span>)}</div></Panel>}
        <div className="flex flex-wrap items-center gap-3"><DownloadButton text={s.clean} filename="image.svg" mime="image/svg+xml" label="Download sanitized SVG" /><CopyButton text={s.clean} label="Copy sanitized" /><Button onClick={() => setSrc(s.clean)}>Replace source with sanitized</Button><Check_ label="Show sanitized markup" checked={showRaw} onChange={setShowRaw} /></div>
        {showRaw && <pre className="mono scroll-thin max-h-64 overflow-auto rounded-md border bg-muted/40 p-3 text-xs">{s.clean}</pre>}</>)}
    </div>
  )
}
