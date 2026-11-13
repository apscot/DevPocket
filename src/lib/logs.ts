export type Level = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL' | 'UNKNOWN'
export const LEVELS: Level[] = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL', 'UNKNOWN']
export interface LogEntry { n: number; raw: string; ts?: string; tsMs?: number; level: Level; thread?: string; logger?: string; message: string; lines: number }

const TS = /(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d{1,9})?(?:Z|[+-]\d{2}:?\d{2})?)|(\d{2}\/[A-Za-z]{3}\/\d{4}:\d{2}:\d{2}:\d{2} [+-]\d{4})|([A-Z][a-z]{2}\s+\d{1,2} \d{2}:\d{2}:\d{2})|(\b\d{13}\b)/
const LVL = /\b(TRACE|DEBUG|INFO|WARN(?:ING)?|ERROR|SEVERE|FATAL|CRITICAL)\b/
const START = new RegExp(TS.source + '|' + LVL.source)

export function parseTimestamp(s: string, tz: 'local' | 'utc' = 'utc'): number | undefined {
  let m: RegExpExecArray | null
  if ((m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:[.,](\d{1,9}))?(Z|[+-]\d{2}:?\d{2})?$/.exec(s))) {
    const ms = m[7] ? Number(m[7].padEnd(3, '0').slice(0, 3)) : 0
    if (m[8]) { const off = m[8] === 'Z' ? 'Z' : m[8].replace(/^([+-]\d{2})(\d{2})$/, '$1:$2'); const d = Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.${String(ms).padStart(3, '0')}${off}`); return Number.isNaN(d) ? undefined : d }
    const args = [Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]), ms] as const
    return tz === 'utc' ? Date.UTC(...args) : new Date(...args).getTime()
  }
  if ((m = /^(\d{2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-]\d{4})$/.exec(s))) { const d = Date.parse(`${m[2]} ${m[1]} ${m[3]} ${m[4]}:${m[5]}:${m[6]} GMT${m[7]}`); return Number.isNaN(d) ? undefined : d }
  if ((m = /^([A-Z][a-z]{2})\s+(\d{1,2}) (\d{2}):(\d{2}):(\d{2})$/.exec(s))) { const d = Date.parse(`${m[1]} ${m[2]} ${new Date().getFullYear()} ${m[3]}:${m[4]}:${m[5]} ${tz === 'utc' ? 'GMT' : ''}`); return Number.isNaN(d) ? undefined : d }
  if (/^\d{13}$/.test(s)) return Number(s)
  return undefined
}

export function parseLogs(text: string, tz: 'local' | 'utc' = 'utc'): LogEntry[] {
  const out: LogEntry[] = []
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  lines.forEach((raw, i) => {
    if (!raw.trim()) return
    const tm = TS.exec(raw), lm = LVL.exec(raw)
    const isStart = (tm && tm.index < 40) || (lm && lm.index < 60) || /^\[?\w+\]?\s/.test(raw) && false
    if (!isStart && out.length && (/^\s/.test(raw) || /^(Caused by|\.\.\.|at )/.test(raw) || !tm)) { const l = out[out.length - 1]; l.raw += '\n' + raw; l.message += '\n' + raw; l.lines++; return }
    const level = (lm ? (lm[1] === 'WARNING' ? 'WARN' : lm[1] === 'SEVERE' || lm[1] === 'CRITICAL' ? 'ERROR' : lm[1]) : 'UNKNOWN') as Level
    const thread = /\[([^\]]{1,60})\]/.exec(raw)?.[1]
    let rest = raw
    if (lm) rest = raw.slice(lm.index + lm[0].length)
    else if (tm) rest = raw.slice(tm.index + tm[0].length)
    const logger = /^\s*(?:\d+\s+---\s+)?(?:\[[^\]]*\]\s+)?([\w$.]+(?:\.[\w$]+)+)\s*(?:[:-]|\s)/.exec(rest)?.[1]
    const msg = (rest.includes(' : ') ? rest.slice(rest.indexOf(' : ') + 3) : rest.replace(/^\s*[-:]\s*/, '')).trim()
    out.push({ n: i + 1, raw, ts: tm?.[0], tsMs: tm ? parseTimestamp(tm[0], tz) : undefined, level, thread, logger, message: msg || raw, lines: 1 })
  })
  return out
}
export const groupKey = (m: string) => m.split('\n')[0].replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<uuid>').replace(/\b0x[0-9a-f]+\b/gi, '<hex>').replace(/\b\d{1,3}(\.\d{1,3}){3}(:\d+)?\b/g, '<ip>').replace(/\b\d+(\.\d+)?\b/g, '<n>').replace(/\s+/g, ' ').trim()

export interface NormOpts { timestamps?: boolean; numbers?: boolean; ids?: boolean; threads?: boolean; level?: boolean; whitespace?: boolean; ips?: boolean }
export function normalizeLogLine(l: string, o: NormOpts): string {
  let t = l
  if (o.timestamps) t = t.replace(new RegExp(TS.source, 'g'), '<ts>')
  if (o.ids) t = t.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<uuid>').replace(/\b[0-9a-f]{16,}\b/gi, '<hex>')
  if (o.ips) t = t.replace(/\b\d{1,3}(\.\d{1,3}){3}(:\d+)?\b/g, '<ip>')
  if (o.threads) t = t.replace(/\[[^\]]*(?:exec|thread|pool|worker|nio|main|scheduling)[^\]]*\]/gi, '[<thread>]')
  if (o.numbers) t = t.replace(/\b\d+(\.\d+)?\b/g, '<n>')
  if (o.level) t = t.replace(LVL, '<lvl>')
  if (o.whitespace) t = t.replace(/\s+/g, ' ').trim()
  return t
}
