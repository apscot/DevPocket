import { useMemo, useState } from 'react'
import { Button, OutputPane, Panel } from '@/components/kit'
import { GITIGNORE, genGitignore } from '@/lib/gitignore'
import { cn } from '@/lib/cn'

const PRESETS: Record<string, string[]> = { 'Spring Boot + Maven + IntelliJ': ['java', 'springboot', 'maven', 'intellij', 'macos', 'windows'], 'Gradle + VS Code': ['java', 'springboot', 'gradle', 'vscode', 'linux'], 'React + Node': ['node', 'react', 'vscode', 'macos', 'windows'] }
export default function GitignoreGenerator() {
  const [sel, setSel] = useState<string[]>(['java', 'springboot', 'maven', 'intellij', 'macos'])
  const out = useMemo(() => genGitignore(sel), [sel])
  const toggle = (k: string) => setSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(280px,1fr)_1.4fr]">
      <Panel title="Templates">
        <div className="mb-3 flex flex-wrap gap-1.5">{Object.entries(PRESETS).map(([n, v]) => <Button key={n} onClick={() => setSel(v)}>{n}</Button>)}<Button onClick={() => setSel([])}>Clear</Button></div>
        <div className="grid gap-1.5 sm:grid-cols-2">{Object.entries(GITIGNORE).map(([k, v]) => (
          <label key={k} className={cn('flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm', sel.includes(k) && 'border-primary bg-accent')}><input type="checkbox" className="accent-[var(--primary)]" checked={sel.includes(k)} onChange={() => toggle(k)} />{v.label}</label>))}</div>
      </Panel>
      <OutputPane title={`.gitignore (${sel.length} templates)`} value={sel.length ? out : ''} filename=".gitignore" rows={22} />
    </div>
  )
}
