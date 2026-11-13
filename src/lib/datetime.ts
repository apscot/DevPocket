import { pad } from './util'

export function tzOffsetMinutes(ms: number, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const p = Object.fromEntries(dtf.formatToParts(new Date(ms)).map((x) => [x.type, x.value]))
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second))
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000)
}
/** Interpret wall-clock components in `tz` and return the UTC epoch ms. Handles DST gaps/overlaps (picks the earlier instant on overlap). */
export function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, s: number, ms: number, tz: string): number {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s, ms)
  const o1 = tzOffsetMinutes(guess, tz)
  const t1 = guess - o1 * 60000
  const o2 = tzOffsetMinutes(t1, tz)
  if (o2 === o1) return t1 // unambiguous (or first occurrence of an overlapping hour)
  const t2 = guess - o2 * 60000
  return tzOffsetMinutes(t2, tz) === o2 ? t2 : t1 // t1 → local time falls in a DST gap, shift forward
}
export const localTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone
export function formatInTz(ms: number, tz: string, o: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, dateStyle: 'medium', timeStyle: 'long', ...o }).format(new Date(ms))
}
export function isoInTz(ms: number, tz: string): string {
  const off = tzOffsetMinutes(ms, tz); const p = new Date(ms + off * 60000)
  const sign = off >= 0 ? '+' : '-'; const a = Math.abs(off)
  return `${p.getUTCFullYear()}-${pad(p.getUTCMonth() + 1)}-${pad(p.getUTCDate())}T${pad(p.getUTCHours())}:${pad(p.getUTCMinutes())}:${pad(p.getUTCSeconds())}.${pad(p.getUTCMilliseconds(), 3)}${off === 0 && tz === 'UTC' ? 'Z' : `${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`}`
}
export const offsetLabel = (ms: number, tz: string) => { const o = tzOffsetMinutes(ms, tz); const a = Math.abs(o); return `UTC${o >= 0 ? '+' : '-'}${pad(Math.floor(a / 60))}:${pad(a % 60)}` }
export const allTimezones = (): string[] => { try { return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf('timeZone') } catch { return ['UTC', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Asia/Kolkata', 'Asia/Tokyo', 'Australia/Sydney'] } }
export function relativeTime(ms: number, now = Date.now()): string {
  const d = Math.round((ms - now) / 1000); const a = Math.abs(d)
  const units: [number, Intl.RelativeTimeFormatUnit][] = [[31536000, 'year'], [2592000, 'month'], [86400, 'day'], [3600, 'hour'], [60, 'minute'], [1, 'second']]
  for (const [s, u] of units) if (a >= s) return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(Math.trunc(d / s), u)
  return 'now'
}

// ---------- epoch detection ----------
export function detectEpoch(n: bigint | number): { unit: 's' | 'ms' | 'us' | 'ns'; ms: number } | null {
  const s = String(n).replace(/^-/, ''); const v = Number(n)
  if (s.length <= 10) return { unit: 's', ms: v * 1000 }
  if (s.length === 13) return { unit: 'ms', ms: v }
  if (s.length === 16) return { unit: 'us', ms: v / 1000 }
  if (s.length === 19) return { unit: 'ns', ms: v / 1e6 }
  return null
}

// ---------- date difference ----------
export interface DateDiff { years: number; months: number; days: number; hours: number; minutes: number; seconds: number; totalDays: number; totalHours: number; totalMinutes: number; totalSeconds: number; totalWeeks: number; negative: boolean }
/** Calendar difference on wall-clock components (a, b are Date objects holding wall-clock values in UTC fields). */
export function dateDiff(a: Date, b: Date, inclusive = false): DateDiff {
  let neg = false; let s = a, e = b
  if (s.getTime() > e.getTime()) { neg = true; [s, e] = [e, s] }
  if (inclusive) e = new Date(e.getTime() + 86400000)
  const dim = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  const addMonths = (n: number) => { const y = s.getUTCFullYear(), m = s.getUTCMonth() + n; const yy = y + Math.floor(m / 12), mm = ((m % 12) + 12) % 12; return Date.UTC(yy, mm, Math.min(s.getUTCDate(), dim(yy, mm)), s.getUTCHours(), s.getUTCMinutes(), s.getUTCSeconds()) }
  let months = (e.getUTCFullYear() - s.getUTCFullYear()) * 12 + (e.getUTCMonth() - s.getUTCMonth())
  while (months > 0 && addMonths(months) > e.getTime()) months--
  let rest = Math.floor((e.getTime() - addMonths(months)) / 1000)
  const days = Math.floor(rest / 86400); rest -= days * 86400
  const hours = Math.floor(rest / 3600); rest -= hours * 3600
  const minutes = Math.floor(rest / 60), seconds = rest - minutes * 60
  const ms = e.getTime() - s.getTime()
  return { years: Math.floor(months / 12), months: months % 12, days, hours, minutes, seconds, totalDays: ms / 86400000, totalHours: ms / 3600000, totalMinutes: ms / 60000, totalSeconds: ms / 1000, totalWeeks: ms / 604800000, negative: neg }
}

// ---------- cron ----------
export type CronDialect = 'unix' | 'spring' | 'quartz'
export interface CronField { name: string; min: number; max: number; names?: string[] }
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'], DOWS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
export interface ParsedCron { dialect: CronDialect; sec: number[]; min: number[]; hour: number[]; dom: number[] | null; month: number[]; dow: number[] | null; domL?: boolean; dowL?: number; dowNth?: [number, number]; year?: number[]; fields: string[] }

function expandField(raw: string, min: number, max: number, names: string[] | undefined, offset = 0): number[] {
  const set = new Set<number>()
  const val = (s: string): number => {
    const u = s.toUpperCase()
    if (names) { const i = names.indexOf(u); if (i >= 0) return i + offset }
    if (!/^\d+$/.test(s)) throw new Error(`Invalid value “${s}”`)
    return Number(s)
  }
  for (const part of raw.split(',')) {
    if (!part) throw new Error('Empty list item')
    const [rng, stepS] = part.split('/'); const step = stepS === undefined ? 1 : Number(stepS)
    if (!Number.isInteger(step) || step < 1) throw new Error(`Invalid step “${stepS}”`)
    let lo: number, hi: number
    if (rng === '*' || rng === '?') { lo = min; hi = max } else if (rng.includes('-')) { const [a, b] = rng.split('-'); lo = val(a); hi = val(b) } else { lo = val(rng); hi = stepS !== undefined ? max : lo }
    if (lo < min || hi > max || lo > hi) throw new Error(`Value out of range ${min}–${max}: “${part}”`)
    for (let i = lo; i <= hi; i += step) set.add(i)
  }
  return [...set].sort((a, b) => a - b)
}
export function parseCron(expr: string, dialect: CronDialect): ParsedCron {
  let f = expr.trim().split(/\s+/)
  const alias: Record<string, string> = { '@yearly': '0 0 1 1 *', '@annually': '0 0 1 1 *', '@monthly': '0 0 1 * *', '@weekly': '0 0 * * 0', '@daily': '0 0 * * *', '@midnight': '0 0 * * *', '@hourly': '0 * * * *' }
  if (alias[f[0]] && dialect === 'unix') f = alias[f[0]].split(' ')
  const want = dialect === 'unix' ? [5] : dialect === 'spring' ? [6] : [6, 7]
  if (!want.includes(f.length)) throw new Error(`${dialect === 'unix' ? 'Unix cron' : dialect === 'spring' ? 'Spring' : 'Quartz'} expressions need ${want.join(' or ')} fields (${dialect === 'unix' ? 'minute hour day-of-month month day-of-week' : 'second minute hour day-of-month month day-of-week' + (dialect === 'quartz' ? ' [year]' : '')}); found ${f.length}.`)
  const hasSec = dialect !== 'unix'
  const [sS, mS, hS, dS, moS, wS, yS] = hasSec ? f : ['0', ...f]
  const wrap = (label: string, fn: () => number[]) => { try { return fn() } catch (e) { throw new Error(`${label}: ${(e as Error).message}`) } }
  const res: ParsedCron = {
    dialect, fields: f, sec: wrap('Seconds', () => expandField(sS, 0, 59, undefined)), min: wrap('Minutes', () => expandField(mS, 0, 59, undefined)), hour: wrap('Hours', () => expandField(hS, 0, 23, undefined)),
    month: wrap('Month', () => expandField(moS, 1, 12, MONTHS, 1)), dom: null, dow: null,
  }
  const isAny = (s: string) => s === '*' || s === '?'
  if (!isAny(dS)) { if (dS.toUpperCase() === 'L') { res.domL = true; res.dom = [] } else res.dom = wrap('Day of month', () => expandField(dS, 1, 31, undefined)) }
  if (!isAny(wS)) {
    const q = dialect === 'quartz'
    // Quartz numbers days 1–7 with SUN=1; Unix/Spring use 0–7 with SUN=0 (7 also Sunday).
    const dowVals = (x: string) => (q ? wrap('Day of week', () => expandField(x, 1, 7, DOWS, 1)).map((n) => n - 1) : wrap('Day of week', () => expandField(x, 0, 7, DOWS, 0)).map((n) => n % 7))
    const nth = /^([A-Za-z0-9]+)#([1-5])$/.exec(wS); const last = /^([A-Za-z0-9]+)L$/.exec(wS)
    if (q && nth) { res.dowNth = [dowVals(nth[1])[0], Number(nth[2])]; res.dow = [] }
    else if (q && last) { res.dowL = dowVals(last[1])[0]; res.dow = [] }
    else res.dow = [...new Set(dowVals(wS))].sort()
  }
  if (yS) res.year = wrap('Year', () => expandField(yS, 1970, 2199, undefined))
  return res
}
export function nextRuns(c: ParsedCron, from: Date, count = 10, tz: 'local' | 'utc' = 'local'): Date[] {
  const out: Date[] = []
  const get = tz === 'utc' ? (d: Date) => ({ y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), w: d.getUTCDay() }) : (d: Date) => ({ y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate(), w: d.getDay() })
  const mk = (y: number, m: number, d: number, h: number, mi: number, s: number) => (tz === 'utc' ? new Date(Date.UTC(y, m - 1, d, h, mi, s)) : new Date(y, m - 1, d, h, mi, s))
  let day = tz === 'utc' ? new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())) : new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const lastDom = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()
  for (let i = 0; i < 366 * 8 && out.length < count; i++, day = tz === 'utc' ? new Date(day.getTime() + 86400000) : new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)) {
    const { y, m, d, w } = get(day)
    if (c.year && !c.year.includes(y)) continue
    if (!c.month.includes(m)) continue
    const domOk = c.dom === null ? null : c.domL ? d === lastDom(y, m) : c.dom.includes(d)
    const dowOk = c.dow === null ? null : c.dowNth ? w === c.dowNth[0] && Math.ceil(d / 7) === c.dowNth[1] : c.dowL !== undefined ? w === c.dowL && d + 7 > lastDom(y, m) : c.dow.includes(w)
    const dayOk = c.dialect === 'unix' ? (domOk === null && dowOk === null ? true : domOk !== null && dowOk !== null ? domOk || dowOk : (domOk ?? dowOk)) : (domOk ?? true) && (dowOk ?? true)
    if (!dayOk) continue
    for (const h of c.hour) for (const mi of c.min) for (const s of c.sec) { const t = mk(y, m, d, h, mi, s); if (t.getTime() > from.getTime()) { out.push(t); if (out.length >= count) return out } }
  }
  return out
}
const ord = (n: number) => n + (['th', 'st', 'nd', 'rd'][(n % 100 >> 3 ^ 1 && n % 10 < 4) ? n % 10 : 0] ?? 'th')
export function explainCron(c: ParsedCron): string {
  const f = c.fields; const hasSec = c.dialect !== 'unix'; const [sec, min, hour, dom, mon, dow] = hasSec ? f : ['0', ...f]
  const list = (a: number[], fn: (n: number) => string) => a.length <= 6 ? a.map(fn).join(', ') : `${fn(a[0])} … ${fn(a[a.length - 1])} (${a.length} values)`
  const two = (n: number) => pad(n)
  const parts: string[] = []
  const stepOf = (s: string) => /^(\*|\d+-\d+|\d+)\/(\d+)$/.exec(s)
  let time: string
  if (min === '*' && hour === '*' && (sec === '0' || !hasSec)) time = 'Every minute'
  else if (stepOf(min) && hour === '*') time = `Every ${stepOf(min)![2]} minutes`
  else if (stepOf(min) && hour !== '*') time = `Every ${stepOf(min)![2]} minutes, ` + (/^\d+-\d+$/.test(hour) ? `between ${two(c.hour[0])}:00 and ${two(c.hour[c.hour.length - 1])}:59` : c.hour.length === 1 ? `during hour ${two(c.hour[0])}` : `during hours ${list(c.hour, String)}`)
  else if (hour === '*' && c.min.length === 1) time = c.min[0] === 0 ? 'Every hour, on the hour' : `Every hour at minute ${c.min[0]}`
  else if (stepOf(hour) && c.min.length === 1) time = `At minute ${c.min[0]}, every ${stepOf(hour)![2]} hours`
  else if (c.hour.length * c.min.length <= 6) time = 'At ' + c.hour.flatMap((h) => c.min.map((m) => `${two(h)}:${two(m)}`)).join(', ')
  else time = `At minute${c.min.length > 1 ? 's' : ''} ${list(c.min, String)} past hour${c.hour.length > 1 ? 's' : ''} ${list(c.hour, String)}`
  if (hasSec && sec !== '0') time += stepOf(sec) ? `, every ${stepOf(sec)![2]} seconds` : `, at second${c.sec.length > 1 ? 's' : ''} ${list(c.sec, String)}`
  parts.push(time)
  if (c.domL) parts.push('on the last day of the month'); else if (c.dom) parts.push(`on the ${list(c.dom, ord)} of the month`)
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  if (c.dowNth) parts.push(`on the ${ord(c.dowNth[1])} ${names[c.dowNth[0]]} of the month`); else if (c.dowL !== undefined) parts.push(`on the last ${names[c.dowL]} of the month`)
  else if (c.dow) parts.push(c.dow.length === 5 && c.dow.join() === '1,2,3,4,5' ? 'Monday through Friday' : `on ${list(c.dow, (n) => names[n])}`)
  if (mon !== '*') parts.push(`in ${list(c.month, (n) => ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][n - 1])}`)
  if (c.year) parts.push(`in ${list(c.year, String)}`)
  if (c.dialect === 'unix' && c.dom && c.dow) parts.push('(Unix cron: runs when EITHER day-of-month OR day-of-week matches)')
  void dow; void dom
  return parts.join(', ')
}

// ---------- snowflake ----------
export const SNOWFLAKE_PRESETS: Record<string, { label: string; epoch: bigint; ts: number; dc: number; worker: number; seq: number; note: string }> = {
  twitter: { label: 'Twitter / X', epoch: 1288834974657n, ts: 41, dc: 5, worker: 5, seq: 12, note: 'Twitter epoch 2010-11-04' },
  discord: { label: 'Discord', epoch: 1420070400000n, ts: 42, dc: 5, worker: 5, seq: 12, note: 'Discord epoch 2015-01-01; “datacenter” = internal worker, “worker” = process' },
  instagram: { label: 'Instagram', epoch: 1314220021721n, ts: 41, dc: 0, worker: 13, seq: 10, note: '41-bit time, 13-bit shard, 10-bit sequence' },
  custom: { label: 'Custom', epoch: 0n, ts: 41, dc: 5, worker: 5, seq: 12, note: 'Set your own epoch and bit widths' },
}
export function decodeSnowflake(id: bigint, epoch: bigint, dc: number, worker: number, seq: number) {
  const mask = (n: number) => (1n << BigInt(n)) - 1n
  const sequence = id & mask(seq), w = (id >> BigInt(seq)) & mask(worker), d = (id >> BigInt(seq + worker)) & mask(dc)
  const tsPart = id >> BigInt(seq + worker + dc)
  return { timestampMs: Number(tsPart + epoch), tsPart, datacenter: d, worker: w, sequence }
}
export function composeSnowflake(ms: number, epoch: bigint, dc: number, worker: number, seq: number, d: bigint, w: bigint, s: bigint) {
  return ((BigInt(ms) - epoch) << BigInt(seq + worker + dc)) | (d << BigInt(seq + worker)) | (w << BigInt(seq)) | s
}

// ---------- CSS units ----------
export const CSS_UNITS = ['px', 'rem', 'em', 'pt', 'pc', 'in', 'cm', 'mm', 'vw', 'vh', '%'] as const
export type CssUnit = (typeof CSS_UNITS)[number]
export function cssToPx(v: number, u: CssUnit, ctx: { root: number; parent: number; vw: number; vh: number; percentOf: number }): number {
  switch (u) { case 'px': return v; case 'rem': return v * ctx.root; case 'em': return v * ctx.parent; case 'pt': return (v * 96) / 72; case 'pc': return v * 16; case 'in': return v * 96; case 'cm': return (v * 96) / 2.54; case 'mm': return (v * 96) / 25.4; case 'vw': return (v * ctx.vw) / 100; case 'vh': return (v * ctx.vh) / 100; case '%': return (v * ctx.percentOf) / 100 }
}
export function pxToCss(px: number, u: CssUnit, ctx: { root: number; parent: number; vw: number; vh: number; percentOf: number }): number {
  switch (u) { case 'px': return px; case 'rem': return px / ctx.root; case 'em': return px / ctx.parent; case 'pt': return (px * 72) / 96; case 'pc': return px / 16; case 'in': return px / 96; case 'cm': return (px * 2.54) / 96; case 'mm': return (px * 25.4) / 96; case 'vw': return (px / ctx.vw) * 100; case 'vh': return (px / ctx.vh) * 100; case '%': return (px / ctx.percentOf) * 100 }
}
