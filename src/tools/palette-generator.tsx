import { useMemo, useState } from 'react'
import { CopyButton, Field, Input, Notice, OutputPane, Panel, Select, Tabs } from '@/components/kit'
import { palette, parseColor, toHex, type Scheme } from '@/lib/color'

export default function PaletteGenerator() {
  const [base, setBase] = useState('#0F766E'); const [scheme, setScheme] = useState<Scheme>('analogous'); const [count, setCount] = useState(5); const [fmt, setFmt] = useState<'css' | 'json' | 'tailwind' | 'scss'>('css')
  const r = useMemo(() => { try { return { cols: palette(parseColor(base), scheme, count).map((c) => toHex({ ...c, a: 1 })), err: '' } } catch (e) { return { cols: [] as string[], err: (e as Error).message } } }, [base, scheme, count])
  const out = fmt === 'css' ? `:root {\n${r.cols.map((c, i) => `  --color-${i + 1}: ${c};`).join('\n')}\n}` : fmt === 'json' ? JSON.stringify(r.cols, null, 2) : fmt === 'scss' ? r.cols.map((c, i) => `$color-${i + 1}: ${c};`).join('\n') : `// tailwind.config.js\ntheme: { extend: { colors: {\n  palette: {\n${r.cols.map((c, i) => `    ${(i + 1) * 100}: '${c}',`).join('\n')}\n  }\n} } }`
  return (
    <div className="flex flex-col gap-3">
      <Panel title="Base"><div className="grid gap-3 sm:grid-cols-4"><Field label="Base color"><div className="flex gap-2"><input type="color" aria-label="Base color picker" value={(() => { try { return toHex(parseColor(base)).slice(0, 7) } catch { return '#000000' } })()} onChange={(e) => setBase(e.target.value.toUpperCase())} className="h-9 w-12 cursor-pointer rounded border bg-card" /><Input value={base} onChange={(e) => setBase(e.target.value)} className="mono" aria-label="Base color" /></div></Field>
        <Field label="Scheme"><Select value={scheme} onChange={(e) => setScheme(e.target.value as Scheme)} aria-label="Scheme"><option value="complementary">Complementary</option><option value="analogous">Analogous</option><option value="triadic">Triadic</option><option value="tetradic">Tetradic</option><option value="split">Split-complementary</option><option value="monochromatic">Monochromatic</option></Select></Field>
        <Field label="Swatches"><Input type="number" min={2} max={10} value={count} onChange={(e) => setCount(Math.min(10, Math.max(2, Number(e.target.value) || 2)))} /></Field></div></Panel>
      {r.err && <Notice kind="error">{r.err}</Notice>}
      {r.cols.length > 0 && <Panel title="Palette"><div className="grid grid-cols-2 gap-2 sm:grid-cols-5" data-testid="swatches">{r.cols.map((c) => <div key={c + Math.random()} className="overflow-hidden rounded-md border"><div className="h-20" style={{ background: c }} /><div className="flex items-center justify-between px-2 py-1"><code className="mono text-xs">{c}</code><CopyButton text={c} size="icon" label={`Copy ${c}`} /></div></div>)}</div></Panel>}
      <Tabs value={fmt} onChange={setFmt} items={[['css', 'CSS'], ['scss', 'SCSS'], ['json', 'JSON'], ['tailwind', 'Tailwind']]} />
      <OutputPane title="Export" value={r.cols.length ? out : ''} filename={`palette.${fmt === 'json' ? 'json' : fmt === 'tailwind' ? 'js' : fmt}`} rows={8} />
    </div>
  )
}
