import { useMemo, useState } from 'react'
import { CopyButton, Empty, Field, Input, Notice, Panel, Select, Button, Tabs } from '@/components/kit'
import { explainCron, nextRuns, parseCron, type CronDialect } from '@/lib/datetime'

const PRESETS: [string, string, CronDialect][] = [['Every minute', '* * * * *', 'unix'], ['Every 5 minutes', '*/5 * * * *', 'unix'], ['Hourly', '0 * * * *', 'unix'], ['Daily at 02:30', '30 2 * * *', 'unix'], ['Weekdays 09:00', '0 9 * * 1-5', 'unix'], ['Monthly (1st, midnight)', '0 0 1 * *', 'unix'], ['Every 10 seconds (Spring)', '*/10 * * * * *', 'spring'], ['Last day of month 23:00 (Quartz)', '0 0 23 L * ?', 'quartz'], ['2nd Friday 10:00 (Quartz)', '0 0 10 ? * 6#2', 'quartz']]
type Mode = 'every' | 'step' | 'list' | 'range'
const FIELDS: Record<CronDialect, { key: string; label: string; min: number; max: number }[]> = {
  unix: [{ key: 'min', label: 'Minute', min: 0, max: 59 }, { key: 'hour', label: 'Hour', min: 0, max: 23 }, { key: 'dom', label: 'Day of month', min: 1, max: 31 }, { key: 'mon', label: 'Month', min: 1, max: 12 }, { key: 'dow', label: 'Day of week (0=Sun)', min: 0, max: 6 }],
  spring: [{ key: 'sec', label: 'Second', min: 0, max: 59 }, { key: 'min', label: 'Minute', min: 0, max: 59 }, { key: 'hour', label: 'Hour', min: 0, max: 23 }, { key: 'dom', label: 'Day of month', min: 1, max: 31 }, { key: 'mon', label: 'Month', min: 1, max: 12 }, { key: 'dow', label: 'Day of week', min: 0, max: 7 }],
  quartz: [{ key: 'sec', label: 'Second', min: 0, max: 59 }, { key: 'min', label: 'Minute', min: 0, max: 59 }, { key: 'hour', label: 'Hour', min: 0, max: 23 }, { key: 'dom', label: 'Day of month', min: 1, max: 31 }, { key: 'mon', label: 'Month', min: 1, max: 12 }, { key: 'dow', label: 'Day of week (1=Sun)', min: 1, max: 7 }],
}
const DIALECT_NOTE: Record<CronDialect, string> = {
  unix: 'Unix/Vixie cron — 5 fields: minute hour day-of-month month day-of-week. Day-of-week 0 or 7 = Sunday. If both day fields are restricted, a run happens when EITHER matches.',
  spring: 'Spring @Scheduled(cron) — 6 fields with seconds. Day-of-week names (MON-FRI) and “?” are accepted. Both day fields must match.',
  quartz: 'Quartz — 6 or 7 fields (optional year). Supports ? L and #. Day-of-week is numbered 1–7 with SUN=1 (or use names like MON-FRI); “6#2” = second Friday, “6L” = last Friday.',
}
export default function CronBuilder() {
  const [dialect, setDialect] = useState<CronDialect>('unix'); const [expr, setExpr] = useState('*/15 9-17 * * 1-5'); const [tz, setTz] = useState<'local' | 'utc'>('local'); const [tab, setTab] = useState<'text' | 'visual'>('text')
  const res = useMemo(() => { try { const p = parseCron(expr, dialect); return { runs: nextRuns(p, new Date(), 10, tz), text: explainCron(p), err: '' } } catch (e) { return { runs: [] as Date[], text: '', err: (e as Error).message } } }, [expr, dialect, tz])
  const parts = expr.trim().split(/\s+/); const defs = FIELDS[dialect]
  const setPart = (i: number, v: string) => { const p = parts.length === defs.length ? [...parts] : defs.map((_, k) => parts[k] ?? '*'); p[i] = v || '*'; setExpr(p.join(' ')) }
  const fmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'medium', timeZone: tz === 'utc' ? 'UTC' : undefined })
  return (
    <div className="flex flex-col gap-3">
      <Notice kind="info">{DIALECT_NOTE[dialect]}</Notice>
      <Panel title="Expression" actions={<CopyButton text={expr} />}>
        <div className="grid gap-3 sm:grid-cols-[180px_1fr_140px]"><Field label="Dialect"><Select value={dialect} onChange={(e) => { const d = e.target.value as CronDialect; setDialect(d); setExpr(d === 'unix' ? '*/15 9-17 * * 1-5' : d === 'spring' ? '0 */15 9-17 * * MON-FRI' : '0 */15 9-17 ? * MON-FRI') }} aria-label="Dialect"><option value="unix">Unix (5 fields)</option><option value="spring">Spring (6 fields)</option><option value="quartz">Quartz (6–7 fields)</option></Select></Field>
          <Field label="Cron expression"><Input value={expr} onChange={(e) => setExpr(e.target.value)} className="mono text-base" aria-label="Cron expression" /></Field><Field label="Preview in"><Select value={tz} onChange={(e) => setTz(e.target.value as 'utc')}><option value="local">Browser time</option><option value="utc">UTC</option></Select></Field></div>
        <div className="mt-3 flex flex-wrap gap-1.5">{PRESETS.filter((p) => p[2] === dialect || (dialect !== 'unix' && p[2] === 'unix' && false)).map(([l, e]) => <Button key={l} onClick={() => setExpr(e)}>{l}</Button>)}{dialect !== 'unix' && PRESETS.filter((p) => p[2] === 'unix').slice(0, 3).map(([l, e]) => <Button key={l} onClick={() => setExpr('0 ' + e.replace(/\* \*$/, dialect === 'quartz' ? '* ?' : '* *'))}>{l}</Button>)}</div>
      </Panel>
      {res.err ? <Notice kind="error">{res.err}</Notice> : <Panel title="Meaning"><p className="text-base font-medium" data-testid="cron-explain">{res.text}</p></Panel>}
      <Tabs value={tab} onChange={setTab} items={[['text', 'Next runs'], ['visual', 'Field builder']]} />
      {tab === 'visual' ? (
        <Panel title="Build field by field"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{defs.map((d, i) => <FieldBuilder key={d.key + dialect} def={d} value={parts[i] ?? '*'} onChange={(v) => setPart(i, v)} />)}</div></Panel>
      ) : (
        <Panel title="Next 10 runs">{res.runs.length ? <ol className="space-y-1 text-sm" data-testid="cron-runs">{res.runs.map((d, i) => <li key={i} className="mono"><span className="mr-2 text-muted-foreground">{i + 1}.</span>{fmt.format(d)}</li>)}</ol> : <Empty>{res.err ? 'Fix the expression to see upcoming runs.' : 'No upcoming runs found within 8 years.'}</Empty>}</Panel>
      )}
    </div>
  )
}
function FieldBuilder({ def, value, onChange }: { def: { label: string; min: number; max: number }; value: string; onChange: (v: string) => void }) {
  const detect = (): Mode => (value === '*' || value === '?' ? 'every' : /^\*\/\d+$/.test(value) ? 'step' : /^\d+-\d+$/.test(value) ? 'range' : 'list')
  const [mode, setMode] = useState<Mode>(detect())
  const [n, setN] = useState(5)
  return (
    <div className="rounded-md border p-2.5"><div className="mb-1.5 text-xs font-semibold text-muted-foreground">{def.label}</div>
      <Select aria-label={`${def.label} mode`} value={mode} onChange={(e) => { const m = e.target.value as Mode; setMode(m); onChange(m === 'every' ? '*' : m === 'step' ? `*/${n}` : m === 'range' ? `${def.min}-${def.max}` : String(def.min)) }}><option value="every">Every</option><option value="step">Every N</option><option value="list">Specific value(s)</option><option value="range">Range</option></Select>
      {mode === 'step' && <Input className="mt-2" type="number" min={1} max={def.max} value={n} onChange={(e) => { setN(Number(e.target.value)); onChange(`*/${e.target.value || 1}`) }} aria-label={`${def.label} step`} />}
      {(mode === 'list' || mode === 'range') && <Input className="mono mt-2" value={value} onChange={(e) => onChange(e.target.value)} placeholder={mode === 'range' ? `${def.min}-${def.max}` : '1,15,30'} aria-label={`${def.label} value`} />}
      <p className="mono mt-1 text-[11px] text-muted-foreground">{value}</p></div>
  )
}
