import { useMemo, useState } from 'react'
import { Button, Check_, CopyButton, Empty, Field, Grid, Input, Notice, Panel, Stat } from '@/components/kit'
import { dateDiff } from '@/lib/datetime'
import { pad } from '@/lib/util'

const nowLocal = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}` }
const toWall = (s: string): Date | null => { const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(s); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0))) : null }
export default function DateDiff() {
  const [a, setA] = useState('2024-01-15T09:30'); const [b, setB] = useState(nowLocal()); const [incl, setIncl] = useState(false)
  const r = useMemo(() => { const x = toWall(a), y = toWall(b); return x && y ? dateDiff(x, y, incl) : null }, [a, b, incl])
  const text = r ? `${r.years} years, ${r.months} months, ${r.days} days, ${r.hours} hours, ${r.minutes} minutes` : ''
  return (
    <div className="flex flex-col gap-3">
      <Panel title="Dates"><div className="grid gap-3 sm:grid-cols-2">
        <Field label="Start"><div className="flex gap-2"><Input type="datetime-local" value={a} onChange={(e) => setA(e.target.value)} aria-label="Start date" /><Button onClick={() => setA(nowLocal())}>Now</Button></div></Field>
        <Field label="End"><div className="flex gap-2"><Input type="datetime-local" value={b} onChange={(e) => setB(e.target.value)} aria-label="End date" /><Button onClick={() => setB(nowLocal())}>Now</Button></div></Field>
      </div><div className="mt-3"><Check_ label="Inclusive (count the end day too, +1 day)" checked={incl} onChange={setIncl} /></div></Panel>
      {!r ? <Empty>Enter two valid dates.</Empty> : (<>
        {r.negative && <Notice kind="info">The end date is before the start date; the difference is shown as an absolute value.</Notice>}
        <Panel title="Difference" actions={<CopyButton text={text} />}><p className="text-lg font-semibold" data-testid="diff-text">{text}</p></Panel>
        <Grid cols={4}><Stat label="Years" value={r.years} /><Stat label="Months" value={r.months} /><Stat label="Days" value={r.days} /><Stat label="Hours" value={r.hours} /><Stat label="Minutes" value={r.minutes} /><Stat label="Seconds" value={r.seconds} /></Grid>
        <Panel title="Totals"><Grid cols={4}><Stat label="Total days" value={+r.totalDays.toFixed(4)} /><Stat label="Total weeks" value={+r.totalWeeks.toFixed(3)} /><Stat label="Total hours" value={+r.totalHours.toFixed(2)} /><Stat label="Total minutes" value={Math.round(r.totalMinutes).toLocaleString()} /></Grid><p className="mt-2 text-[11px] text-muted-foreground">Calendar math uses wall-clock values, so daylight-saving shifts do not distort the result.</p></Panel>
      </>)}
    </div>
  )
}
