import { useEffect, useMemo, useRef, useState } from 'react'
import { Check_, Empty, Field, Grid, Input, Notice, Panel, Stat, Tabs, Textarea, CopyButton } from '@/components/kit'
import { explainRegex } from '@/lib/regexExplain'
import { cn } from '@/lib/cn'

interface Match { index: number; text: string; groups: (string | undefined)[]; named: Record<string, string | undefined> }
const FLAGS: [string, string][] = [['g', 'global'], ['i', 'ignore case'], ['m', 'multiline'], ['s', 'dotAll'], ['u', 'unicode'], ['y', 'sticky'], ['d', 'indices']]
const CHEAT: [string, string][] = [['.', 'any char'], ['\\d \\w \\s', 'digit / word / space'], ['[abc] [^abc] [a-z]', 'sets & ranges'], ['* + ? {n,m}', 'quantifiers (add ? for lazy)'], ['^ $ \\b', 'anchors / word boundary'], ['(…) (?:…) (?<n>…)', 'capture / non-capture / named'], ['(?=…) (?!…) (?<=…) (?<!…)', 'lookaround'], ['a|b', 'alternation'], ['\\1 \\k<n>', 'backreferences'], ['$1 $<n> $&', 'replacement tokens']]
export default function RegexPlayground() {
  const [pattern, setPattern] = useState('(?<user>[\\w.]+)@(?<host>[\\w-]+\\.[a-z]{2,})'); const [flags, setFlags] = useState('gi'); const [text, setText] = useState('Contact ada@example.com or grace@navy.mil.\nBad: foo@bar')
  const [repl, setRepl] = useState('$<host>: $<user>'); const [tab, setTab] = useState<'match' | 'replace' | 'explain'>('match')
  const [res, setRes] = useState<{ matches: Match[]; truncated?: boolean; replaced?: string } | null>(null); const [err, setErr] = useState(''); const [timeout, setTimeoutMsg] = useState(false)
  const worker = useRef<Worker | null>(null)
  useEffect(() => {
    setTimeoutMsg(false)
    if (!pattern) { setRes(null); setErr(''); return }
    try { new RegExp(pattern, flags) } catch (e) { setErr((e as Error).message); setRes(null); return }
    setErr('')
    const id = setTimeout(() => {
      worker.current?.terminate()
      const w = new Worker(new URL('../workers/regex.worker.ts', import.meta.url), { type: 'module' }); worker.current = w
      const kill = setTimeout(() => { w.terminate(); setTimeoutMsg(true); setRes(null) }, 2000) // guards against catastrophic backtracking
      w.onmessage = (e) => { clearTimeout(kill); if (e.data.ok) setRes(e.data); else { setErr(e.data.error); setRes(null) } w.terminate() }
      w.postMessage({ pattern, flags, text, replacement: repl })
    }, 150)
    return () => clearTimeout(id)
  }, [pattern, flags, text, repl])
  useEffect(() => () => worker.current?.terminate(), [])
  const toggle = (f: string) => setFlags(flags.includes(f) ? flags.replace(f, '') : flags + f)
  const highlighted = useMemo(() => {
    if (!res) return null
    const out: React.ReactNode[] = []; let last = 0
    res.matches.forEach((m, i) => { if (m.index < last) return; out.push(text.slice(last, m.index)); out.push(<mark key={i} className="rounded-sm bg-primary/25 outline outline-1 outline-primary/50" title={`Match ${i + 1}`}>{m.text || '\u200b'}</mark>); last = m.index + m.text.length })
    out.push(text.slice(last)); return out
  }, [res, text])
  const explained = useMemo(() => explainRegex(pattern), [pattern])
  return (
    <div className="flex flex-col gap-3">
      <Panel title="Pattern"><div className="grid gap-3"><div className="flex items-center gap-2"><span className="mono text-muted-foreground">/</span><Input value={pattern} onChange={(e) => setPattern(e.target.value)} className="mono" aria-label="Regex pattern" spellCheck={false} /><span className="mono text-muted-foreground">/{flags}</span></div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">{FLAGS.map(([f, l]) => <Check_ key={f} label={<span><b className="mono">{f}</b> <span className="text-muted-foreground">{l}</span></span>} checked={flags.includes(f)} onChange={() => toggle(f)} />)}</div></div></Panel>
      {err && <Notice kind="error">Invalid pattern: {err}</Notice>}
      {timeout && <Notice kind="error">The expression took longer than 2 seconds and was stopped — it likely has catastrophic backtracking (nested quantifiers like (a+)+).</Notice>}
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Test string"><Textarea aria-label="Test string" value={text} onChange={(e) => setText(e.target.value)} rows={10} className="w-full" /></Panel>
        <Panel title={res ? `Matches highlighted (${res.matches.length}${res.truncated ? '+' : ''})` : 'Matches highlighted'}><pre className="mono scroll-thin max-h-[290px] min-h-[120px] overflow-auto whitespace-pre-wrap break-words rounded-md border bg-background p-3" data-testid="regex-highlight">{highlighted ?? text}</pre></Panel>
      </div>
      <Tabs value={tab} onChange={setTab} items={[['match', 'Matches & groups'], ['replace', 'Replace'], ['explain', 'Explain']]} />
      {tab === 'match' && (!res ? <Empty>Enter a valid pattern and test string.</Empty> : !res.matches.length ? <Notice kind="info">No matches.</Notice> : (
        <Panel title="Match details"><div className="scroll-thin max-h-96 overflow-auto"><table className="w-full text-sm" data-testid="regex-matches"><thead className="text-left text-xs text-muted-foreground"><tr><th className="p-1.5">#</th><th>Index</th><th>Match</th><th>Groups</th></tr></thead><tbody>{res.matches.slice(0, 500).map((m, i) => (
          <tr key={i} className="border-t align-top"><td className="p-1.5">{i + 1}</td><td className="mono">{m.index}</td><td className="mono break-all">{m.text}</td><td className="mono text-xs">{m.groups.map((g, k) => <div key={k}><span className="text-muted-foreground">${k + 1}</span> {g === undefined ? <i className="text-muted-foreground">undefined</i> : g}</div>)}{Object.entries(m.named).map(([k, v]) => <div key={k}><span className="text-primary">{k}</span>: {v ?? <i>undefined</i>}</div>)}</td></tr>))}</tbody></table></div></Panel>))}
      {tab === 'replace' && <Panel title="Replacement" actions={res?.replaced !== undefined && <CopyButton text={res.replaced} />}><Field label="Replace with ($1, $<name>, $&)"><Input value={repl} onChange={(e) => setRepl(e.target.value)} className="mono" aria-label="Replacement" /></Field><pre className="mono mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-md border bg-background p-3" data-testid="regex-replaced">{res?.replaced ?? ''}</pre></Panel>}
      {tab === 'explain' && <Panel title="Pattern explained"><ul className="space-y-1">{explained.map((e, i) => <li key={i} className="flex gap-3 text-sm"><code className="mono w-40 shrink-0 break-all text-primary">{e.token}</code><span>{e.text}</span></li>)}{!explained.length && <Empty>Enter a pattern.</Empty>}</ul>
        <div className="mt-4 border-t pt-3"><p className="mb-1 text-xs font-semibold text-muted-foreground">Cheat sheet</p><div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">{CHEAT.map(([a, b]) => <div key={a} className={cn('flex gap-2 text-xs')}><code className="mono w-44 shrink-0">{a}</code><span className="text-muted-foreground">{b}</span></div>)}</div></div></Panel>}
      {res && <Grid cols={3}><Stat label="Matches" value={res.matches.length} /><Stat label="Flags" value={flags || '—'} /><Stat label="Engine" value="JavaScript (ECMAScript)" /></Grid>}
    </div>
  )
}
