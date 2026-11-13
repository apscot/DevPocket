import { useMemo, useState } from 'react'
import { Button, Field, Grid, Input, Notice, OutputPane, Panel, Tabs, Textarea, Stat } from '@/components/kit'
import { fromTemplate, randomJson, rng } from '@/lib/mock'
import { jsonStats } from '@/lib/json'

const TPL = `{
  "id": "uuid",
  "user": { "name": "fullName", "email": "email", "age": "integer:18-65" },
  "role": "enum:admin,editor,viewer",
  "tags": ["word"],
  "createdAt": "datetime"
}`
export default function RandomJson() {
  const [mode, setMode] = useState<'random' | 'template'>('random')
  const [depth, setDepth] = useState(3); const [maxKeys, setMaxKeys] = useState(4); const [maxItems, setMaxItems] = useState(3)
  const [seed, setSeed] = useState(''); const [tpl, setTpl] = useState(TPL); const [len, setLen] = useState(3); const [nonce, setNonce] = useState(0)
  const res = useMemo(() => {
    void nonce
    try {
      const sd = seed.trim() === '' ? undefined : Number(seed)
      const v = mode === 'random' ? randomJson({ depth: Math.min(8, Math.max(1, depth)), maxKeys: Math.min(15, maxKeys), maxItems: Math.min(50, maxItems), seed: sd }) : fromTemplate(JSON.parse(tpl), rng(sd), Math.min(100, len))
      const out = JSON.stringify(v, null, 2)
      JSON.parse(out) // validate the generated output round-trips
      const st = jsonStats(v)
      return { out, err: '', st }
    } catch (e) { return { out: '', err: (e as Error).message, st: null } }
  }, [mode, depth, maxKeys, maxItems, seed, tpl, len, nonce])
  return (
    <div className="flex flex-col gap-3">
      <Tabs value={mode} onChange={setMode} items={[['random', 'Random structure'], ['template', 'From template']]} />
      <div className="grid gap-3 lg:grid-cols-[minmax(300px,1fr)_1fr]">
        <Panel title="Configuration">
          {mode === 'random' ? (
            <Grid cols={2}>
              <Field label="Max depth (1–8)"><Input type="number" min={1} max={8} value={depth} onChange={(e) => setDepth(Number(e.target.value))} /></Field>
              <Field label="Max keys per object"><Input type="number" min={1} max={15} value={maxKeys} onChange={(e) => setMaxKeys(Number(e.target.value))} /></Field>
              <Field label="Max array length"><Input type="number" min={0} max={50} value={maxItems} onChange={(e) => setMaxItems(Number(e.target.value))} /></Field>
              <Field label="Seed (optional)"><Input value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="random" /></Field>
            </Grid>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Leaf values are type names: uuid, fullName, email, integer:min-max, float, boolean, date, datetime, enum:a,b,c, word, sentence, url, ipv4… An array with one element repeats that element.</p>
              <Textarea aria-label="Template" value={tpl} onChange={(e) => setTpl(e.target.value)} rows={12} className="w-full" />
              <Grid cols={2}><Field label="Array length"><Input type="number" min={0} max={100} value={len} onChange={(e) => setLen(Number(e.target.value))} /></Field><Field label="Seed (optional)"><Input value={seed} onChange={(e) => setSeed(e.target.value)} /></Field></Grid>
            </div>
          )}
          <Button className="mt-3" variant="default" onClick={() => setNonce(nonce + 1)}>Generate again</Button>
        </Panel>
        <div className="flex min-w-0 flex-col gap-3">
          {res.err ? <Notice kind="error">{res.err}</Notice> : <Notice kind="success">Generated output validated as well-formed JSON.</Notice>}
          {res.st && <Grid cols={4}><Stat label="Nodes" value={res.st.totalNodes} /><Stat label="Depth" value={res.st.maxDepth} /><Stat label="Objects" value={res.st.objects} /><Stat label="Arrays" value={res.st.arrays} /></Grid>}
          <OutputPane value={res.out} filename="random.json" mime="application/json" rows={20} />
        </div>
      </div>
    </div>
  )
}
