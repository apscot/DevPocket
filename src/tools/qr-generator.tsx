import { useEffect, useState } from 'react'
import { Button, Field, Grid, Input, Notice, Panel, Select, Textarea, Empty } from '@/components/kit'
import { downloadBlob, downloadText } from '@/lib/util'

export default function QrGenerator() {
  const [text, setText] = useState(''); const [size, setSize] = useState(320); const [ecl, setEcl] = useState<'L' | 'M' | 'Q' | 'H'>('M'); const [margin, setMargin] = useState(2)
  const [fg, setFg] = useState('#000000'); const [bg, setBg] = useState('#ffffff')
  const [png, setPng] = useState(''); const [svg, setSvg] = useState(''); const [err, setErr] = useState('')
  useEffect(() => {
    let live = true
    if (!text) { setPng(''); setSvg(''); setErr(''); return }
    ;(async () => {
      try {
        const QR = (await import('qrcode')).default
        const o = { errorCorrectionLevel: ecl, margin, color: { dark: fg, light: bg } }
        const [p, s] = await Promise.all([QR.toDataURL(text, { ...o, width: size }), QR.toString(text, { ...o, type: 'svg' })])
        if (live) { setPng(p); setSvg(s); setErr('') }
      } catch (e) { if (live) { setErr((e as Error).message); setPng(''); setSvg('') } }
    })()
    return () => { live = false }
  }, [text, size, ecl, margin, fg, bg])
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="flex flex-col gap-3">
        <Panel title="Content" actions={<Button onClick={() => setText('https://example.com/?ref=devpocket')}>Sample</Button>}><Textarea aria-label="QR content" value={text} onChange={(e) => setText(e.target.value)} rows={5} className="w-full" placeholder="Text, URL, Wi-Fi string (WIFI:T:WPA;S:name;P:pass;;), vCard…" /></Panel>
        <Panel title="Options"><Grid cols={2}>
          <Field label="Size (px)"><Input type="number" min={64} max={2048} step={16} value={size} onChange={(e) => setSize(Math.min(2048, Math.max(64, Number(e.target.value) || 64)))} /></Field>
          <Field label="Error correction"><Select value={ecl} onChange={(e) => setEcl(e.target.value as 'L')}><option value="L">L – 7%</option><option value="M">M – 15%</option><option value="Q">Q – 25%</option><option value="H">H – 30%</option></Select></Field>
          <Field label="Margin (modules)"><Input type="number" min={0} max={10} value={margin} onChange={(e) => setMargin(Number(e.target.value))} /></Field>
          <div className="flex gap-3"><Field label="Foreground"><input type="color" value={fg} onChange={(e) => setFg(e.target.value)} className="h-9 w-14 cursor-pointer rounded border bg-card" aria-label="Foreground color" /></Field><Field label="Background"><input type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="h-9 w-14 cursor-pointer rounded border bg-card" aria-label="Background color" /></Field></div>
        </Grid></Panel>
      </div>
      <Panel title="Preview" actions={<><Button disabled={!png} onClick={async () => downloadBlob('qrcode.png', await (await fetch(png)).blob())}>PNG</Button><Button disabled={!svg} onClick={() => downloadText('qrcode.svg', svg, 'image/svg+xml')}>SVG</Button></>}>
        {err && <Notice kind="error">{err}</Notice>}
        {png ? <div className="flex justify-center rounded-md border p-4" style={{ background: bg }}><img src={png} alt="Generated QR code" style={{ width: Math.min(size, 360), height: Math.min(size, 360), imageRendering: 'pixelated' }} /></div> : !err && <Empty>Enter content to generate a QR code. Everything is rendered locally.</Empty>}
        {ecl === 'L' && png && <p className="mt-2 text-xs text-muted-foreground">Low error correction: the code may fail if printed small or damaged.</p>}
      </Panel>
    </div>
  )
}
