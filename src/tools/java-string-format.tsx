import { useMemo, useState } from 'react'
import { Notice, Panel, Textarea, Input, Field, Button, Stat, Grid } from '@/components/kit'
import { javaFormat, parseArg } from '@/lib/javafmt'

export default function JavaFormatTester() {
  const [fmt, setFmt] = useState('Hello, %s! You are %d years old. Balance: %,.2f%n')
  const [args, setArgs] = useState('"Ada"\n36\n1234567.891')
  const r = useMemo(() => {
    try { return { out: javaFormat(fmt, args.split('\n').filter((l) => l.trim() !== '').map(parseArg)), err: '' } } catch (e) { return { out: '', err: (e as Error).message } }
  }, [fmt, args])
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Format string"><Field label="String.format(…)"><Input className="mono" value={fmt} onChange={(e) => setFmt(e.target.value)} aria-label="Format string" /></Field>
          <div className="mt-2 flex flex-wrap gap-1">{['%s', '%d', '%05d', '%,d', '%.2f', '%10.3f', '%-10s|', '%x', '%08.3f', '%b', '%c', '%e', '%n', '%2$s %1$s'].map((t) => <Button key={t} onClick={() => setFmt(fmt + t)} className="mono h-7 px-2 text-xs">{t}</Button>)}</div></Panel>
        <Panel title="Arguments (one per line)"><Textarea aria-label="Arguments" value={args} onChange={(e) => setArgs(e.target.value)} rows={5} className="w-full" placeholder={'"text" or bare text\n42  → int/long\n3.14  → double\ntrue\n\'c\'\nnull'} />
          <p className="mt-1 text-[11px] text-muted-foreground">Integers → Long, decimals → Double, true/false → Boolean, 'c' → Character, otherwise String.</p></Panel>
      </div>
      {r.err ? <Notice kind="error"><span className="mono">{r.err}</span></Notice> : <Panel title="Result"><pre className="mono whitespace-pre-wrap break-all rounded-md bg-muted/50 p-3" data-testid="java-result">{r.out}</pre><Grid cols={2} className="mt-2"><Stat label="Length" value={r.out.length} /><Stat label="Lines" value={r.out.split('\n').length} /></Grid></Panel>}
      <Notice kind="info"><b>Supported:</b> %s %S %d %x %X %o %f %e %E %g %c %b %B %h %n %% with flags <code>- + space 0 , ( # &lt;</code>, width, precision and argument indexes (<code>%1$s</code>). Floating-point uses Java’s HALF_UP rounding. <b>Not supported:</b> %t/%T date-time, %a hex-float, Locale-specific symbols, Formattable / BigDecimal / BigInteger-specific behavior (all numbers are treated as long / double).</Notice>
    </div>
  )
}
