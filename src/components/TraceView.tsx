import { Hl } from './kit'
import { pkgOf, simpleName, type Exc, type Frame } from '@/lib/javatrace'
import { cn } from '@/lib/cn'

function FrameRow({ f, q }: { f: Frame; q: string }) {
  return (
    <div className={cn('mono break-all py-0.5 pl-4 text-[12.5px]', f.framework ? 'text-muted-foreground' : 'font-medium')} data-framework={f.framework}>
      <span className="text-muted-foreground">at </span>
      <span className={f.framework ? '' : 'text-foreground'}><Hl text={f.cls} q={q} /></span><span className="text-muted-foreground">.</span><span className="text-primary"><Hl text={f.method} q={q} /></span>
      <span className="text-muted-foreground">(</span>
      {f.file ? <span className="text-warning"><Hl text={f.file} q={q} /></span> : <span className="italic">{f.location}</span>}
      {f.line != null && <><span className="text-muted-foreground">:</span><span className="text-success">{f.line}</span></>}
      <span className="text-muted-foreground">)</span>
    </div>
  )
}

export function ExcCard({ e, q, hideFramework, showFrames = true, index }: { e: Exc; q: string; hideFramework: boolean; showFrames?: boolean; index: number }) {
  const hidden = hideFramework ? e.frames.filter((f) => f.framework).length : 0
  const frames = hideFramework ? e.frames.filter((f) => !f.framework) : e.frames
  const color = e.kind === 'root' ? 'border-l-destructive' : e.kind === 'cause' ? 'border-l-warning' : 'border-l-primary'
  return (
    <div className={cn('min-w-0 overflow-hidden rounded-md border border-l-4 bg-background p-3', color)} style={{ marginLeft: e.kind === 'root' ? 0 : 16 }} data-testid={`exc-${index}`}>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{e.kind === 'root' ? 'Exception' : e.kind === 'cause' ? 'Caused by' : 'Suppressed'}</span>
        <span className="mono text-sm"><span className="text-muted-foreground"><Hl text={pkgOf(e.type) ? pkgOf(e.type) + '.' : ''} q={q} /></span><b className="text-destructive"><Hl text={simpleName(e.type)} q={q} /></b></span>
      </div>
      {e.message && <p className="mono mt-1 whitespace-pre-wrap break-words rounded bg-muted/60 px-2 py-1 text-[13px]"><Hl text={e.message} q={q} /></p>}
      {showFrames && <div className="mt-1.5">
        {frames.map((f, i) => <FrameRow key={i} f={f} q={q} />)}
        {hidden > 0 && <div className="pl-4 text-xs italic text-muted-foreground">… {hidden} framework frame{hidden > 1 ? 's' : ''} hidden</div>}
        {e.omitted ? <div className="pl-4 text-xs italic text-muted-foreground">… {e.omitted} {e.omittedText}</div> : null}
      </div>}
    </div>
  )
}
