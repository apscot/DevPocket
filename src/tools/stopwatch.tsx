import { useEffect, useRef, useState } from 'react'
import { Flag, Pause, Play, RotateCcw } from 'lucide-react'
import { Button, CopyButton, Empty, Panel } from '@/components/kit'

const fmt = (ms: number) => { const t = Math.floor(ms); const h = Math.floor(t / 3600000), m = Math.floor(t / 60000) % 60, s = Math.floor(t / 1000) % 60, c = Math.floor((t % 1000) / 10); return `${h ? h + ':' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}` }
export default function Stopwatch() {
  const [elapsed, setElapsed] = useState(0); const [running, setRunning] = useState(false); const [laps, setLaps] = useState<{ total: number; split: number }[]>([])
  const base = useRef(0); const start = useRef(0); const raf = useRef(0)
  useEffect(() => {
    if (!running) return
    start.current = performance.now()
    const tick = () => { setElapsed(base.current + performance.now() - start.current); raf.current = requestAnimationFrame(tick) }
    raf.current = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf.current); base.current += performance.now() - start.current }
  }, [running])
  const lap = () => setLaps((l) => [{ total: elapsed, split: elapsed - (l[0]?.total ?? 0) }, ...l])
  const reset = () => { setRunning(false); base.current = 0; setElapsed(0); setLaps([]) }
  const best = laps.length > 1 ? Math.min(...laps.map((l) => l.split)) : -1, worst = laps.length > 1 ? Math.max(...laps.map((l) => l.split)) : -1
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-3">
      <Panel><div className="py-4 text-center"><div className="mono text-6xl font-bold tabular-nums" role="timer" aria-live="off" data-testid="sw-display">{fmt(elapsed)}</div>
        <div className="mt-5 flex justify-center gap-2"><Button variant="default" size="default" onClick={() => setRunning(!running)} data-testid="sw-toggle">{running ? <><Pause size={15} />Pause</> : <><Play size={15} />{elapsed ? 'Resume' : 'Start'}</>}</Button><Button size="default" onClick={lap} disabled={!running} data-testid="sw-lap"><Flag size={15} />Lap</Button><Button size="default" onClick={reset} disabled={!elapsed && !laps.length} data-testid="sw-reset"><RotateCcw size={15} />Reset</Button></div></div></Panel>
      <Panel title={`Laps (${laps.length})`} actions={laps.length > 0 && <CopyButton text={[...laps].reverse().map((l, i) => `${i + 1}\t${fmt(l.split)}\t${fmt(l.total)}`).join('\n')} />}>
        {!laps.length ? <Empty>Press Lap while running to record split times.</Empty> : <table className="mono w-full text-sm"><thead className="text-left text-xs text-muted-foreground"><tr><th>#</th><th>Split</th><th>Total</th></tr></thead><tbody>{laps.map((l, i) => <tr key={i} className="border-t"><td>{laps.length - i}</td><td className={l.split === best ? 'text-success' : l.split === worst ? 'text-destructive' : ''}>{fmt(l.split)}</td><td>{fmt(l.total)}</td></tr>)}</tbody></table>}</Panel>
    </div>
  )
}
