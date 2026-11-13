import { useMemo, useState } from 'react'
import { Empty, Field, Grid, Notice, OutputPane, Panel, Select, Stat, Textarea, Button } from '@/components/kit'
import { fillTemplate, parseKv, placeholders, type PhStyle } from '@/lib/text'

const TPL = 'Hello {{name}},\n\nYour order {{orderId}} ships to {{city}} on {{date}}.\n\n— {{sender}}'
const VARS = 'name=Ada\norderId=A-1042\ncity=London\ndate=2024-03-11'
export default function TemplateReplacer() {
  const [tpl, setTpl] = useState(''); const [vars, setVars] = useState(''); const [style, setStyle] = useState<PhStyle>('mustache'); const [miss, setMiss] = useState<'keep' | 'empty' | 'error'>('keep')
  const r = useMemo(() => { if (!tpl) return null; try { const kv = parseKv(vars); return { ...fillTemplate(tpl, kv, style, miss), err: '', found: placeholders(tpl, style) } } catch (e) { return { out: '', missing: [] as string[], unused: [] as string[], count: 0, err: (e as Error).message, found: [] as string[] } } }, [tpl, vars, style, miss])
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3"><Field label="Placeholder style"><Select value={style} onChange={(e) => setStyle(e.target.value as PhStyle)} className="w-48"><option value="mustache">{'{{name}}'}</option><option value="dollar">{'${name}'}</option><option value="percent">%name%</option><option value="single">{'{name}'}</option><option value="angle">{'<name>'}</option></Select></Field>
        <Field label="Missing values"><Select value={miss} onChange={(e) => setMiss(e.target.value as 'keep')} className="w-44"><option value="keep">Keep placeholder</option><option value="empty">Replace with empty</option><option value="error">Show error</option></Select></Field><Button onClick={() => { setTpl(TPL); setVars(VARS) }}>Sample</Button></div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Template"><Textarea aria-label="Template" value={tpl} onChange={(e) => setTpl(e.target.value)} rows={10} className="w-full" placeholder="Hello {{name}}…" />{r && r.found.length > 0 && <p className="mt-1.5 text-xs text-muted-foreground">Placeholders: {r.found.join(', ')}</p>}</Panel>
        <Panel title="Values (key=value lines or JSON)"><Textarea aria-label="Values" value={vars} onChange={(e) => setVars(e.target.value)} rows={10} className="w-full" placeholder={'name=Ada\ncity=London'} /></Panel>
      </div>
      {r?.err && <Notice kind="error">{r.err}</Notice>}
      {!r ? <Empty>Enter a template and values to see the filled result.</Empty> : !r.err && (<>
        <Grid cols={3}><Stat label="Replaced" value={r.count - r.missing.length} tone="ok" /><Stat label="Missing" value={r.missing.length} tone={r.missing.length ? 'bad' : undefined} /><Stat label="Unused values" value={r.unused.length} /></Grid>
        {r.missing.length > 0 && <Notice kind="warn">No value for: {r.missing.join(', ')}</Notice>}
        <OutputPane value={r.out} filename="output.txt" rows={10} />
      </>)}
    </div>
  )
}
