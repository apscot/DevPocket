import { useMemo, useState } from 'react'
import { Check_, Field, Grid, Input, Notice, OutputPane, Panel, Select } from '@/components/kit'
import { genGha, type GhaOpts } from '@/lib/dockergen'

const init: GhaOpts = { kind: 'maven', name: 'CI', push: true, pr: true, dispatch: false, schedule: '', branches: 'main', javaVersion: '21', nodeVersion: '20', cache: true, upload: false, matrix: false, runner: 'ubuntu-latest', dockerImage: '', pushImage: false }
export default function GhaGenerator() {
  const [o, setO] = useState(init)
  const set = (p: Partial<GhaOpts>) => setO({ ...o, ...p })
  const res = useMemo(() => { try { return { out: genGha(o), err: '' } } catch (e) { return { out: '', err: (e as Error).message } } }, [o])
  const java = o.kind === 'maven' || o.kind === 'gradle'
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(320px,1fr)_1fr]">
      <Panel title="Workflow"><Grid cols={2}>
        <Field label="Workflow type"><Select value={o.kind} onChange={(e) => set({ kind: e.target.value as GhaOpts['kind'] })}><option value="maven">Java / Maven</option><option value="gradle">Java / Gradle</option><option value="node">Node.js</option><option value="react">React / Vite</option><option value="docker">Docker build (& push)</option><option value="pages">Static site → GitHub Pages</option></Select></Field>
        <Field label="Workflow name"><Input value={o.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Branches (comma)"><Input value={o.branches} onChange={(e) => set({ branches: e.target.value })} /></Field>
        <Field label="Cron schedule (optional)"><Input value={o.schedule} onChange={(e) => set({ schedule: e.target.value })} placeholder="0 3 * * 1" className="mono" /></Field>
        {java && <Field label="Java version"><Select value={o.javaVersion} onChange={(e) => set({ javaVersion: e.target.value })}>{['11', '17', '21', '25'].map((v) => <option key={v}>{v}</option>)}</Select></Field>}
        {!java && o.kind !== 'docker' && <Field label="Node version"><Select value={o.nodeVersion} onChange={(e) => set({ nodeVersion: e.target.value })}>{['18', '20', '22'].map((v) => <option key={v}>{v}</option>)}</Select></Field>}
        <Field label="Runner"><Select value={o.runner} onChange={(e) => set({ runner: e.target.value })}><option>ubuntu-latest</option><option>ubuntu-24.04</option><option>windows-latest</option><option>macos-latest</option></Select></Field>
        {o.kind === 'docker' && <Field label="Image name"><Input value={o.dockerImage} onChange={(e) => set({ dockerImage: e.target.value })} placeholder="ghcr.io/${{ github.repository }}" className="mono" /></Field>}
      </Grid>
        <div className="mt-3 flex flex-wrap gap-4"><Check_ label="on push" checked={o.push} onChange={(v) => set({ push: v })} /><Check_ label="on pull_request" checked={o.pr} onChange={(v) => set({ pr: v })} /><Check_ label="manual (workflow_dispatch)" checked={o.dispatch} onChange={(v) => set({ dispatch: v })} /><Check_ label="Dependency caching" checked={o.cache} onChange={(v) => set({ cache: v })} />
          {o.kind !== 'docker' && o.kind !== 'pages' && <><Check_ label="Upload artifact" checked={o.upload} onChange={(v) => set({ upload: v })} /><Check_ label="OS matrix" checked={o.matrix} onChange={(v) => set({ matrix: v })} /></>}{o.kind === 'docker' && <Check_ label="Push to GHCR" checked={o.pushImage} onChange={(v) => set({ pushImage: v })} />}</div>
      </Panel>
      <div className="flex min-w-0 flex-col gap-3">{res.err && <Notice kind="error">{res.err}</Notice>}<OutputPane title=".github/workflows/ci.yml" value={res.out} filename="ci.yml" mime="text/yaml" rows={26} /></div>
    </div>
  )
}
