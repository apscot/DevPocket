import { useMemo, useState } from 'react'
import { Notice, Panel, Select, Textarea, Field, OutputPane, Button, Grid, Stat } from '@/components/kit'
import { replaceSqlVariables, type PlaceholderStyle } from '@/lib/sql'
import { format } from 'sql-formatter'

const SQL = "SELECT * FROM users WHERE email = ? AND status = ? AND age > ? AND created < :since"
export default function SqlInline() {
  const [sql, setSql] = useState(''); const [params, setParams] = useState(''); const [style, setStyle] = useState<PlaceholderStyle>('auto'); const [pretty, setPretty] = useState(false)
  const r = useMemo(() => (sql.trim() ? replaceSqlVariables(sql, params, style) : null), [sql, params, style])
  const out = r ? (pretty ? (() => { try { return format(r.sql) } catch { return r.sql } })() : r.sql) : ''
  return (
    <div className="flex flex-col gap-3">
      <Notice kind="warn">The output is for <b>inspection and debugging only</b>. Never execute SQL built by string substitution — use parameterized queries / prepared statements to prevent SQL injection.</Notice>
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="SQL with placeholders" actions={<Button onClick={() => { setSql(SQL); setParams('alice@example.com\nACTIVE\n21\n2024-01-01') }}>Sample</Button>}><Textarea aria-label="SQL" value={sql} onChange={(e) => setSql(e.target.value)} rows={10} className="w-full" placeholder="SELECT … WHERE id = ? / :id / $1 / ${id} / #{id}" /></Panel>
        <Panel title="Parameter values"><Textarea aria-label="Parameters" value={params} onChange={(e) => setParams(e.target.value)} rows={10} className="w-full" placeholder={'One value per line, name=value lines, a JSON array/object,\nor Hibernate "binding parameter [1] as [VARCHAR] - [abc]" log lines'} /></Panel>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Placeholder style"><Select value={style} onChange={(e) => setStyle(e.target.value as PlaceholderStyle)} className="w-56"><option value="auto">Auto-detect</option><option value="qmark">? positional (JDBC)</option><option value="colon">:name</option><option value="at">@name</option><option value="dollar">$1, $2 (PostgreSQL)</option><option value="braces">{'${name}'}</option><option value="mybatis">{'#{name}'} (MyBatis)</option></Select></Field>
        <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm"><input type="checkbox" checked={pretty} onChange={(e) => setPretty(e.target.checked)} className="accent-[var(--primary)]" />Pretty-print result</label>
      </div>
      {r && <Grid cols={3}><Stat label="Replaced" value={r.used} tone="ok" /><Stat label="Missing values" value={r.missing.length} tone={r.missing.length ? 'bad' : undefined} /><Stat label="Unused values" value={r.unused} /></Grid>}
      {r && r.missing.length > 0 && <Notice kind="error">No value supplied for: {r.missing.join(', ')}</Notice>}
      <OutputPane title="Resulting SQL (inspection only)" value={out} filename="query.sql" mime="application/sql" rows={8} />
    </div>
  )
}
