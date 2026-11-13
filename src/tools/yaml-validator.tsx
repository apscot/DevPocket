import { useMemo, useState } from 'react'
import { Empty, InputPane, Notice, Stat, Grid } from '@/components/kit'
import { validateYaml } from '@/lib/yamlutil'
import { SAMPLE_YAML } from '@/lib/samples'

export default function YamlValidator() {
  const [t, setT] = useState('')
  const r = useMemo(() => (t.trim() ? validateYaml(t) : null), [t])
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <InputPane value={t} onChange={setT} sample={SAMPLE_YAML + '  bad: [unclosed\n'} accept=".yml,.yaml" />
      <div className="flex flex-col gap-3">
        {!r ? <Empty>Paste YAML to validate it. Errors include line and column.</Empty> : r.ok ? (
          <><Notice kind="success">Valid YAML syntax.</Notice><Grid cols={2}><Stat label="Documents" value={r.docs} /><Stat label="Lines" value={t.split('\n').length} /></Grid></>
        ) : (
          <><Notice kind="error"><b data-testid="yaml-error">Invalid YAML{r.line ? ` at line ${r.line}, column ${r.column}` : ''}</b>{'\n'}<span className="mono">{r.error}</span></Notice></>
        )}
      </div>
    </div>
  )
}
