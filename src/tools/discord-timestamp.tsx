import { useMemo, useState } from 'react'
import { Button, CopyButton, Field, Input, Notice, Panel, Select } from '@/components/kit'
import { allTimezones, formatInTz, localTz, relativeTime, zonedToUtc } from '@/lib/datetime'
import { pad } from '@/lib/util'

const STYLES: [string, string, Intl.DateTimeFormatOptions | null][] = [['t', 'Short time', { timeStyle: 'short', dateStyle: undefined }], ['T', 'Long time', { timeStyle: 'medium', dateStyle: undefined }], ['d', 'Short date', { dateStyle: 'short', timeStyle: undefined }], ['D', 'Long date', { dateStyle: 'long', timeStyle: undefined }], ['f', 'Short date/time', { dateStyle: 'long', timeStyle: 'short' }], ['F', 'Long date/time', { dateStyle: 'full', timeStyle: 'short' }], ['R', 'Relative', null]]
export default function DiscordTimestamp() {
  const now = new Date(); const [dt, setDt] = useState(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`); const [tz, setTz] = useState(localTz())
  const zones = useMemo(allTimezones, [])
  const epoch = useMemo(() => { const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(dt); return m ? zonedToUtc(+m[1], +m[2], +m[3], +m[4], +m[5], 0, 0, tz) : null }, [dt, tz])
  const sec = epoch !== null ? Math.floor(epoch / 1000) : null
  return (
    <div className="flex flex-col gap-3">
      <Panel title="Date & time" actions={<Button onClick={() => { const n = new Date(); setDt(`${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}T${pad(n.getHours())}:${pad(n.getMinutes())}`); setTz(localTz()) }}>Now</Button>}>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Date & time"><Input type="datetime-local" value={dt} onChange={(e) => setDt(e.target.value)} aria-label="Date and time" /></Field><Field label="Time zone of the date"><Select value={tz} onChange={(e) => setTz(e.target.value)}>{[...new Set([tz, 'UTC', ...zones])].map((z) => <option key={z}>{z}</option>)}</Select></Field></div>
        {sec !== null && <p className="mt-2 text-xs text-muted-foreground">Unix timestamp: <code className="mono">{sec}</code></p>}</Panel>
      {sec === null ? <Notice kind="error">Enter a valid date and time.</Notice> : (
        <Panel title="Markup"><table className="w-full text-sm" data-testid="discord-table"><thead className="text-left text-xs text-muted-foreground"><tr><th className="p-1.5">Style</th><th>Markup</th><th>Preview (in {localTz()})</th><th /></tr></thead><tbody>{STYLES.map(([k, label, o]) => { const code = `<t:${sec}:${k}>`; return <tr key={k} className="border-t"><td className="p-1.5">{label}</td><td className="mono">{code}</td><td>{o ? formatInTz(sec * 1000, localTz(), o) : relativeTime(sec * 1000)}</td><td><CopyButton text={code} size="icon" label={`Copy ${code}`} /></td></tr> })}</tbody></table>
          <div className="mt-3 flex items-center gap-2"><code className="mono text-sm">{`<t:${sec}>`}</code><CopyButton text={`<t:${sec}>`} label="Copy default" /></div><p className="mt-2 text-[11px] text-muted-foreground">Discord renders each viewer’s local time zone and locale; previews here use your browser’s settings and may differ slightly from Discord’s formatting.</p></Panel>)}
    </div>
  )
}
