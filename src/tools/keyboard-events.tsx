import { useState } from 'react'
import { Button, Check_, Empty, Notice, Panel, Stat, Grid } from '@/components/kit'

interface Ev { id: number; type: string; key: string; code: string; keyCode: number; location: number; mods: string[]; repeat: boolean; composing: boolean; time: string }
let seq = 0
const LOC = ['Standard', 'Left', 'Right', 'Numpad']
export default function KeyboardEvents() {
  const [events, setEvents] = useState<Ev[]>([]); const [prevent, setPrevent] = useState(true); const [up, setUp] = useState(true)
  const capture = (e: React.KeyboardEvent) => {
    if (e.type === 'keyup' && !up) return
    if (prevent && !(e.key === 'Tab')) e.preventDefault()
    const mods = [e.ctrlKey && 'Ctrl', e.shiftKey && 'Shift', e.altKey && 'Alt', e.metaKey && 'Meta', e.getModifierState('CapsLock') && 'CapsLock'].filter(Boolean) as string[]
    setEvents((p) => [{ id: ++seq, type: e.type, key: e.key, code: e.code, keyCode: e.keyCode, location: e.location, mods, repeat: e.repeat, composing: e.nativeEvent.isComposing, time: new Date().toLocaleTimeString([], { hour12: false }) + '.' + String(Date.now() % 1000).padStart(3, '0') }, ...p].slice(0, 50))
  }
  const last = events[0]
  return (
    <div className="flex flex-col gap-3">
      <Notice kind="info">Events are captured only while the box below has focus; nothing is stored or sent. Browser/OS shortcuts may still be intercepted by your system.</Notice>
      <div tabIndex={0} role="textbox" aria-label="Key capture area" data-testid="kb-capture" onKeyDown={capture} onKeyUp={capture} className="flex h-40 items-center justify-center rounded-lg border-2 border-dashed bg-card text-center outline-none focus:border-primary">
        {last ? <div><div className="mono text-5xl font-bold text-primary">{last.key === ' ' ? 'Space' : last.key}</div><div className="mt-1 text-sm text-muted-foreground">{last.code}</div></div> : <p className="text-sm text-muted-foreground">Click here, then press any key</p>}
      </div>
      <div className="flex flex-wrap gap-4"><Check_ label="preventDefault inside the box" checked={prevent} onChange={setPrevent} /><Check_ label="Include keyup events" checked={up} onChange={setUp} /><Button onClick={() => setEvents([])}>Clear</Button></div>
      {last && <Grid cols={4}><Stat label="event.key" value={last.key === ' ' ? '" "' : last.key} /><Stat label="event.code" value={last.code} /><Stat label="keyCode (deprecated)" value={last.keyCode} /><Stat label="location" value={`${last.location} (${LOC[last.location] ?? '?'})`} /><Stat label="Modifiers" value={last.mods.join('+') || 'none'} /><Stat label="repeat" value={String(last.repeat)} /><Stat label="isComposing" value={String(last.composing)} /><Stat label="type" value={last.type} /></Grid>}
      <Panel title={`History (${events.length})`}>{!events.length ? <Empty>No events yet.</Empty> : <div className="scroll-thin max-h-72 overflow-auto"><table className="mono w-full text-xs"><thead className="text-left text-muted-foreground"><tr><th>Time</th><th>Type</th><th>key</th><th>code</th><th>keyCode</th><th>Mods</th></tr></thead><tbody>{events.map((e) => <tr key={e.id} className="border-t"><td>{e.time}</td><td>{e.type}</td><td>{e.key === ' ' ? '" "' : e.key}</td><td>{e.code}</td><td>{e.keyCode}</td><td>{e.mods.join('+')}{e.repeat ? ' (repeat)' : ''}</td></tr>)}</tbody></table></div>}</Panel>
    </div>
  )
}
