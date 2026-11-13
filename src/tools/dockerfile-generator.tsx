import { useMemo, useState } from 'react'
import { Check_, Field, Grid, Input, Notice, OutputPane, Panel, Select, Textarea } from '@/components/kit'
import { genDockerfile, type DockerfileOpts } from '@/lib/dockergen'

const init: DockerfileOpts = { kind: 'spring-boot', build: 'maven', javaVersion: '21', nodeVersion: '20', baseImage: '', port: 8080, workdir: '/app', multiStage: true, nonRoot: true, healthcheck: true, healthPath: '', env: '', buildCommand: '', startCommand: '', jvmOpts: '-XX:MaxRAMPercentage=75', pkgManager: 'npm' }
export default function DockerfileGenerator() {
  const [o, setO] = useState(init)
  const set = (p: Partial<DockerfileOpts>) => setO({ ...o, ...p })
  const res = useMemo(() => { try { return { out: genDockerfile(o), err: '' } } catch (e) { return { out: '', err: (e as Error).message } } }, [o])
  const java = o.kind === 'java-jar' || o.kind === 'spring-boot', node = o.kind === 'node' || o.kind === 'react'
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(320px,1fr)_1fr]">
      <Panel title="Application"><Grid cols={2}>
        <Field label="Application type"><Select value={o.kind} onChange={(e) => { const k = e.target.value as DockerfileOpts['kind']; set({ kind: k, port: k === 'react' || k === 'static' ? 80 : k === 'node' ? 3000 : 8080 }) }}><option value="spring-boot">Spring Boot</option><option value="java-jar">Java (JAR)</option><option value="node">Node.js</option><option value="react">React (Vite/CRA → nginx)</option><option value="static">Static site (nginx)</option></Select></Field>
        <Field label="Port"><Input type="number" value={o.port} onChange={(e) => set({ port: Number(e.target.value) })} aria-label="Port" /></Field>
        {java && <><Field label="Build tool"><Select value={o.build} onChange={(e) => set({ build: e.target.value as 'maven' })}><option value="maven">Maven</option><option value="gradle">Gradle</option></Select></Field><Field label="Java version"><Select value={o.javaVersion} onChange={(e) => set({ javaVersion: e.target.value })}>{['17', '21', '25'].map((v) => <option key={v}>{v}</option>)}</Select></Field></>}
        {node && <><Field label="Node version"><Select value={o.nodeVersion} onChange={(e) => set({ nodeVersion: e.target.value })}>{['18', '20', '22'].map((v) => <option key={v}>{v}</option>)}</Select></Field><Field label="Package manager"><Select value={o.pkgManager} onChange={(e) => set({ pkgManager: e.target.value as 'npm' })}><option>npm</option><option>yarn</option><option>pnpm</option></Select></Field></>}
        <Field label="Base image (override)"><Input value={o.baseImage} onChange={(e) => set({ baseImage: e.target.value })} placeholder="auto" /></Field>
        <Field label="Workdir"><Input value={o.workdir} onChange={(e) => set({ workdir: e.target.value })} /></Field>
        <Field label="Build command (override)"><Input value={o.buildCommand} onChange={(e) => set({ buildCommand: e.target.value })} className="mono" /></Field>
        <Field label="Start command (override)"><Input value={o.startCommand} onChange={(e) => set({ startCommand: e.target.value })} className="mono" /></Field>
        {java && <Field label="JVM options"><Input value={o.jvmOpts} onChange={(e) => set({ jvmOpts: e.target.value })} className="mono" /></Field>}
        <Field label="Health check path"><Input value={o.healthPath} onChange={(e) => set({ healthPath: e.target.value })} placeholder={o.kind === 'spring-boot' ? '/actuator/health' : '/'} /></Field>
      </Grid>
        <Field label="Environment variables (KEY=value per line)" className="mt-3"><Textarea value={o.env} onChange={(e) => set({ env: e.target.value })} rows={3} className="w-full min-h-[70px]" aria-label="Environment variables" /></Field>
        <div className="mt-3 flex flex-wrap gap-4">{(java || o.kind === 'react') && <Check_ label="Multi-stage build" checked={o.multiStage} onChange={(v) => set({ multiStage: v })} />}{(java || o.kind === 'node') && <Check_ label="Run as non-root" checked={o.nonRoot} onChange={(v) => set({ nonRoot: v })} />}<Check_ label="HEALTHCHECK" checked={o.healthcheck} onChange={(v) => set({ healthcheck: v })} /></div>
      </Panel>
      <div className="flex min-w-0 flex-col gap-3">{res.err && <Notice kind="error">{res.err}</Notice>}<OutputPane title="Dockerfile" value={res.out} filename="Dockerfile" rows={24} /></div>
    </div>
  )
}
