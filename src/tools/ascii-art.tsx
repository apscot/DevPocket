import { useEffect, useState } from 'react'
import { Field, Input, Notice, OutputPane, Select } from '@/components/kit'

const FONTS: Record<string, () => Promise<{ default: unknown }>> = {
  Standard: () => import('figlet/importable-fonts/Standard.js'), Slant: () => import('figlet/importable-fonts/Slant.js'), Big: () => import('figlet/importable-fonts/Big.js'), Banner: () => import('figlet/importable-fonts/Banner.js'),
  Block: () => import('figlet/importable-fonts/Block.js'), Doom: () => import('figlet/importable-fonts/Doom.js'), Ghost: () => import('figlet/importable-fonts/Ghost.js'), Small: () => import('figlet/importable-fonts/Small.js'),
}
export default function AsciiArt() {
  const [text, setText] = useState('DevPocket'); const [font, setFont] = useState('Standard'); const [layout, setLayout] = useState('default'); const [width, setWidth] = useState(120)
  const [out, setOut] = useState(''); const [err, setErr] = useState('')
  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const [fig, f] = await Promise.all([import('figlet'), FONTS[font]()])
        const figlet = (fig as any).default ?? fig
        figlet.parseFont(font, f.default)
        const r = figlet.textSync(text || ' ', { font, horizontalLayout: layout, width })
        if (live) { setOut(r); setErr('') }
      } catch (e) { if (live) setErr((e as Error).message) }
    })()
    return () => { live = false }
  }, [text, font, layout, width])
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 rounded-lg border bg-card p-3 sm:grid-cols-4">
        <Field label="Text" className="sm:col-span-2"><Input value={text} onChange={(e) => setText(e.target.value)} aria-label="Text" /></Field>
        <Field label="Font"><Select value={font} onChange={(e) => setFont(e.target.value)}>{Object.keys(FONTS).map((f) => <option key={f}>{f}</option>)}</Select></Field>
        <Field label="Layout"><Select value={layout} onChange={(e) => setLayout(e.target.value)}><option value="default">Default</option><option value="full">Full width</option><option value="fitted">Fitted</option><option value="controlled smushing">Smushed</option></Select></Field>
        <Field label="Wrap width"><Input type="number" min={20} max={400} value={width} onChange={(e) => setWidth(Number(e.target.value) || 80)} /></Field>
      </div>
      {err && <Notice kind="error">{err}</Notice>}
      <OutputPane title="Result" value={out} filename="ascii-art.txt" actions={undefined}><pre className="mono scroll-thin max-h-[420px] overflow-auto rounded-md border bg-background p-3 text-[12px] leading-tight" data-testid="ascii-out">{out}</pre></OutputPane>
    </div>
  )
}
