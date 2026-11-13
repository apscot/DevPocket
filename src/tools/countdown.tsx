import { useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { Button, Field, Input, Notice, Panel } from '@/components/kit'

const fmt = (ms: number) => { const t = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(t / 3600)).padStart(2, '0')}:${String(Math.floor(t / 60) % 60).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}` }
export default function Countdown() {
  const [h, setH] = useState(0); const [m, setM] = useState(5); const [s, setS] = useState(0)
  const total = ((h * 60 + m) * 60 + s) * 1000
  const [remaining, setRemaining] = useState(total); const [running, setRunning] = useState(false); const [done, setDone] = useState(false)
  const endAt = useRef(0)
  useEffect(() => { if (!running) setRemaining(total) }, [total, running])
  useEffect(() => {
    if (!running) return
    endAt.current = performance.now() + remaining
    const id = setInterval(() => { const r = endAt.current - performance.now(); if (r <= 0) { setRemaining(0); setRunning(false); setDone(true); clearInterval(id) } else setRemaining(r) }, 100)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])
  useEffect(() => { document.title = running ? `${fmt(remaining)} — Countdown` : document.title }, [remaining, running])
  const clamp = (v: string, max: number) => Math.min(max, Math.max(0, Number(v) || 0))
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-3">
      <Panel title="Duration"><div className="grid grid-cols-3 gap-3"><Field label="Hours"><Input type="number" min={0} max={99} value={h} disabled={running} onChange={(e) => setH(clamp(e.target.value, 99))} aria-label="Hours" /></Field><Field label="Minutes"><Input type="number" min={0} max={59} value={m} disabled={running} onChange={(e) => setM(clamp(e.target.value, 59))} aria-label="Minutes" /></Field><Field label="Seconds"><Input type="number" min={0} max={59} value={s} disabled={running} onChange={(e) => setS(clamp(e.target.value, 59))} aria-label="Seconds" /></Field></div>
        <div className="mt-2 flex flex-wrap gap-1.5">{[['1 min', 0, 1, 0], ['5 min', 0, 5, 0], ['10 min', 0, 10, 0], ['25 min', 0, 25, 0], ['1 hour', 1, 0, 0]].map(([l, a, b, c]) => <Button key={l as string} disabled={running} onClick={() => { setH(a as number); setM(b as number); setS(c as number); setDone(false) }}>{l}</Button>)}</div></Panel>
      <Panel><div className="py-4 text-center"><div className={`mono text-6xl font-bold tabular-nums ${done ? 'text-destructive' : ''}`} role="timer" data-testid="cd-display">{fmt(remaining)}</div>
        <div className="mt-5 flex justify-center gap-2"><Button variant="default" size="default" disabled={total === 0 || remaining === 0} onClick={() => { setDone(false); setRunning(!running) }} data-testid="cd-toggle">{running ? <><Pause size={15} />Pause</> : <><Play size={15} />{remaining < total ? 'Resume' : 'Start'}</>}</Button><Button size="default" onClick={() => { setRunning(false); setDone(false); setRemaining(total) }} data-testid="cd-reset"><RotateCcw size={15} />Reset</Button></div></div></Panel>
      {done && <Notice kind="success">Time’s up!</Notice>}
    </div>
  )
}
