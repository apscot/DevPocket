import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button, Check_, Field, Input, Notice, OutputPane, Panel, Select, Textarea } from '@/components/kit'
import { COMPOSE_PRESETS, genCompose, type ComposeService } from '@/lib/dockergen'

export default function ComposeGenerator() {
  const [svcs, setSvcs] = useState<ComposeService[]>([COMPOSE_PRESETS.app, { ...COMPOSE_PRESETS.postgres }].map((s) => ({ ...s, dependsOn: s.name === 'app' ? 'postgres' : s.dependsOn })))
  const [ver, setVer] = useState(false)
  const set = (i: number, p: Partial<ComposeService>) => setSvcs(svcs.map((s, k) => (k === i ? { ...s, ...p } : s)))
  const res = useMemo(() => { try { return { out: genCompose(svcs, { version: ver }), err: '' } } catch (e) { return { out: '', err: (e as Error).message } } }, [svcs, ver])
  const add = (k: string) => { const p = COMPOSE_PRESETS[k]; let name = p.name, i = 2; while (svcs.some((s) => s.name === name)) name = p.name + i++; setSvcs([...svcs, { ...p, name }]) }
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(340px,1.1fr)_1fr]">
      <div className="flex flex-col gap-3">
        <Panel title="Add service" actions={<Check_ label="Legacy version key" checked={ver} onChange={setVer} />}><div className="flex flex-wrap gap-1.5">{Object.keys(COMPOSE_PRESETS).map((k) => <Button key={k} onClick={() => add(k)}><Plus size={13} />{k === 'app' ? 'Your app' : k}</Button>)}<Button onClick={() => setSvcs([...svcs, { name: `service${svcs.length + 1}`, image: '', ports: '', env: '', volumes: '', networks: '', dependsOn: '', command: '', restart: '' }])}><Plus size={13} />Custom</Button></div></Panel>
        {svcs.map((s, i) => (
          <Panel key={i} title={s.name || 'service'} actions={<Button variant="ghost" size="icon" aria-label={`Remove ${s.name}`} onClick={() => setSvcs(svcs.filter((_, k) => k !== i))}><Trash2 size={14} /></Button>}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name"><Input value={s.name} onChange={(e) => set(i, { name: e.target.value })} aria-label={`Service ${i + 1} name`} /></Field>
              <Field label="Image"><Input value={s.image} onChange={(e) => set(i, { image: e.target.value })} className="mono" placeholder="postgres:16" /></Field>
              <Field label="Build context"><Input value={s.build ?? ''} onChange={(e) => set(i, { build: e.target.value })} placeholder="." /></Field>
              <Field label="Restart"><Select value={s.restart} onChange={(e) => set(i, { restart: e.target.value })}><option value="">(none)</option><option>no</option><option>always</option><option>unless-stopped</option><option>on-failure</option></Select></Field>
              <Field label="Ports (one per line)"><Textarea value={s.ports} onChange={(e) => set(i, { ports: e.target.value })} rows={2} className="min-h-[56px] w-full" /></Field>
              <Field label="Environment (KEY=value)"><Textarea value={s.env} onChange={(e) => set(i, { env: e.target.value })} rows={2} className="min-h-[56px] w-full" /></Field>
              <Field label="Volumes"><Textarea value={s.volumes} onChange={(e) => set(i, { volumes: e.target.value })} rows={2} className="min-h-[56px] w-full" /></Field>
              <Field label="Networks (comma)"><Input value={s.networks} onChange={(e) => set(i, { networks: e.target.value })} /></Field>
              <Field label="Depends on (comma)"><Input value={s.dependsOn} onChange={(e) => set(i, { dependsOn: e.target.value })} /></Field>
              <Field label="Command"><Input value={s.command} onChange={(e) => set(i, { command: e.target.value })} className="mono" /></Field>
            </div>
          </Panel>))}
      </div>
      <div className="flex min-w-0 flex-col gap-3">{res.err ? <Notice kind="error">{res.err}</Notice> : <Notice kind="success">Generated YAML parsed successfully.</Notice>}<OutputPane title="docker-compose.yml" value={res.out} filename="docker-compose.yml" mime="text/yaml" rows={28} /><Notice kind="warn">Example passwords like “change-me” are placeholders. Use secrets or an .env file for real deployments.</Notice></div>
    </div>
  )
}
