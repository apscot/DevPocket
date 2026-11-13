import { useMemo, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Empty, Grid, InputPane, Notice, Panel, Stat } from '@/components/kit'
import { explainWorkflow } from '@/lib/dockergen'
import { genGha } from '@/lib/dockergen'

const SAMPLE = genGha({ kind: 'maven', name: 'CI', push: true, pr: true, dispatch: true, schedule: '', branches: 'main', javaVersion: '21', nodeVersion: '20', cache: true, upload: true, matrix: false, runner: 'ubuntu-latest', dockerImage: '', pushImage: false }) + `  deploy:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    env:
      API_TOKEN: \${{ secrets.API_TOKEN }}
    steps:
      - uses: actions/download-artifact@v4
      - run: ./deploy.sh
`
export default function GhaExplainer() {
  const [t, setT] = useState('')
  const r = useMemo(() => { if (!t.trim()) return null; try { return { w: explainWorkflow(t), err: '' } } catch (e) { return { w: null, err: (e as Error).message } } }, [t])
  const w = r?.w
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(280px,2fr)_3fr]">
      <InputPane title="Workflow YAML" value={t} onChange={setT} sample={SAMPLE} accept=".yml,.yaml" rows={22} />
      <div className="flex min-w-0 flex-col gap-3">
        <Notice kind="info">Static analysis only — workflows are never executed.</Notice>
        {r?.err && <Notice kind="error">{r.err}</Notice>}
        {!r && <Empty>Paste a workflow file to see its triggers, job graph and steps explained.</Empty>}
        {w && (<>
          <Grid cols={4}><Stat label="Workflow" value={<span className="text-sm">{w.name}</span>} /><Stat label="Triggers" value={w.triggers.length} /><Stat label="Jobs" value={w.jobs.length} /><Stat label="Steps" value={w.jobs.reduce((n, j) => n + j.steps.length, 0)} /></Grid>
          {w.warnings.map((x, i) => <Notice key={i} kind="warn">{x}</Notice>)}
          <Panel title="When it runs"><ul className="space-y-1 text-sm">{w.triggers.map((tr, i) => <li key={i}><b className="mono text-primary">{tr.event}</b>{tr.detail && <span className="text-muted-foreground"> — {tr.detail}</span>}</li>)}</ul>{w.permissions && <p className="mt-2 text-xs text-muted-foreground">Permissions: <code>{w.permissions}</code></p>}{w.env.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Workflow env: <code>{w.env.join(', ')}</code></p>}</Panel>
          <Panel title="Job graph"><div className="flex flex-wrap items-stretch gap-2" data-testid="job-graph">{w.order.map((lvl, li) => (<div key={li} className="flex items-center gap-2">{li > 0 && <ArrowRight size={16} className="text-muted-foreground" />}<div className="flex flex-col gap-2">{lvl.map((id) => { const j = w.jobs.find((x) => x.id === id)!; return <div key={id} className="rounded-md border bg-background px-3 py-2 text-sm"><b>{j.name}</b><div className="text-xs text-muted-foreground">{j.runsOn} · {j.steps.length} steps</div>{j.needs.length > 0 && <div className="text-[11px] text-muted-foreground">needs: {j.needs.join(', ')}</div>}</div> })}</div></div>))}</div></Panel>
          {w.jobs.map((j) => (
            <Panel key={j.id} title={<span>Job <code className="mono text-primary">{j.id}</code></span>}>
              <p className="text-sm text-muted-foreground">Runs on <b>{j.runsOn}</b>{j.needs.length ? <> after <b>{j.needs.join(', ')}</b></> : ' immediately'}{j.cond ? <> only if <code className="mono">{j.cond}</code></> : ''}{j.environment ? <> · environment <b>{j.environment}</b></> : ''}{j.matrix ? <> · matrix <code className="mono">{j.matrix}</code></> : ''}.</p>
              {j.env.length > 0 && <p className="mt-1 text-xs text-muted-foreground">env: <code>{j.env.join(', ')}</code></p>}
              <ol className="mt-2 space-y-1.5 text-sm">{j.steps.map((s, i) => <li key={i} className="flex gap-2"><span className="mono w-5 text-right text-muted-foreground">{i + 1}</span><span><b>{s.name}</b> <span className="rounded bg-muted px-1.5 text-[11px]">{s.kind === 'uses' ? 'action' : s.kind === 'run' ? 'shell' : '?'}</span>{s.kind === 'uses' && s.name !== s.detail && <code className="mono ml-1 text-xs text-muted-foreground">{s.detail}</code>}{s.kind === 'run' && s.detail.includes('\n') && <pre className="mono mt-1 rounded bg-muted p-1.5 text-xs">{s.detail}</pre>}{s.cond && <span className="ml-1 text-xs text-warning">if {s.cond}</span>}{s.env.length > 0 && <span className="ml-1 text-xs text-muted-foreground">env: {s.env.join(', ')}</span>}</span></li>)}</ol>
            </Panel>))}
        </>)}
      </div>
    </div>
  )
}
