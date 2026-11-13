export interface Frame { raw: string; cls: string; method: string; file?: string; line?: number; location: string; module?: string; native: boolean; framework: boolean }
export interface Exc { kind: 'root' | 'cause' | 'suppressed'; type: string; message: string; frames: Frame[]; omitted?: number; omittedText?: string; context: string[]; groupIndex: number }
export interface TraceResult { items: Exc[]; groups: number; unparsed: string[] }

const FRAMEWORK = /^(java|javax|jakarta|jdk|sun|com\.sun|org\.springframework|org\.hibernate|org\.apache|org\.eclipse|io\.netty|reactor|io\.undertow|org\.junit|org\.mockito|com\.zaxxer|org\.postgresql|com\.mysql|org\.slf4j|ch\.qos|com\.fasterxml|kotlin|scala|org\.jboss|org\.glassfish|org\.xnio|io\.micrometer)\./
const FRAME = /^\s*at\s+(?:([\w.$]+)\/)?(?:([\w.$<>\-]+)\.)?([\w$<>\-]+)\(([^)]*)\)\s*(?:~?\[.*\])?\s*$/
const HEAD = /^\s*(Caused by:\s*|Suppressed:\s*)?((?:[a-zA-Z_$][\w$]*\.)+[A-Za-z_$][\w$]*|[A-Z][\w$]*(?:Exception|Error|Throwable))(?::\s?(.*))?\s*$/
const OMIT = /^\s*\.\.\.\s*(\d+)\s*(more|common frames omitted)/i

export function parseFrame(line: string, appPrefix = ''): Frame | null {
  const m = FRAME.exec(line)
  if (!m) return null
  const [, module, cls = '', method, loc] = m
  const lm = /^(.*?):(\d+)$/.exec(loc)
  const full = cls || ''
  const framework = appPrefix && full.startsWith(appPrefix) ? false : FRAMEWORK.test(full + '.')
  return { raw: line.trim(), cls: full, method, file: lm ? lm[1] : /Native|Unknown/.test(loc) ? undefined : loc, line: lm ? Number(lm[2]) : undefined, location: loc, module, native: /Native Method/.test(loc), framework }
}

export function parseTrace(text: string, appPrefix = ''): TraceResult {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const items: Exc[] = []; const unparsed: string[] = []
  let cur: Exc | null = null, ctx: string[] = [], group = -1
  let inMsg = false
  for (const line of lines) {
    if (!line.trim()) { inMsg = false; continue }
    const fr = parseFrame(line, appPrefix)
    if (fr) { inMsg = false; if (cur) cur.frames.push(fr); else unparsed.push(line); continue }
    const om = OMIT.exec(line)
    if (om) { inMsg = false; if (cur) { cur.omitted = Number(om[1]); cur.omittedText = om[2] }; continue }
    // header: strip common log prefix (timestamp/level/thread/logger) before the exception token
    const stripped = line.replace(/^.*?\s:\s(?=(?:[a-zA-Z_$][\w$]*\.)+[A-Za-z_$][\w$]*(?:Exception|Error)\b)/, '')
    const h = HEAD.exec(stripped)
    if (h && (h[1] || /(Exception|Error|Throwable)\b/.test(h[2]) || h[3] !== undefined)) {
      const kind = !h[1] ? 'root' : /Suppressed/i.test(h[1]) ? 'suppressed' : 'cause'
      if (kind === 'root') group++
      cur = { kind, type: h[2], message: h[3] ?? '', frames: [], context: ctx, groupIndex: Math.max(group, 0) }
      if (kind === 'root' && group < 0) group = 0
      ctx = []; items.push(cur); inMsg = true; continue
    }
    if (inMsg && cur && !cur.frames.length) { cur.message += '\n' + line.trim(); continue }
    if (cur && /^\s*\[?Suppressed|^\s+Suppressed/.test(line)) continue
    ctx.push(line); unparsed.push(line)
  }
  return { items, groups: new Set(items.map((i) => i.groupIndex)).size, unparsed }
}
export const simpleName = (t: string) => t.slice(t.lastIndexOf('.') + 1)
export const pkgOf = (t: string) => (t.includes('.') ? t.slice(0, t.lastIndexOf('.')) : '')

export function formatTrace(r: TraceResult, o: { hideFramework?: boolean } = {}): string {
  const out: string[] = []
  r.items.forEach((e, idx) => {
    out.push(`${e.kind === 'root' ? (idx ? '\n' : '') + '▶' : e.kind === 'cause' ? '  Caused by' : '  Suppressed'} ${e.type}`)
    const pad = e.kind === 'root' ? '  ' : '    '
    if (e.message) out.push(...e.message.split('\n').map((l, i) => `${pad}${i ? '  ' : 'Message: '}${l}`))
    let hidden = 0
    for (const f of e.frames) { if (o.hideFramework && f.framework) { hidden++; continue } out.push(`${pad}at ${f.cls}.${f.method}(${f.location})`) }
    if (hidden) out.push(`${pad}… ${hidden} framework frame${hidden > 1 ? 's' : ''} hidden`)
    if (e.omitted) out.push(`${pad}… ${e.omitted} ${e.omittedText ?? 'more'}`)
  })
  return out.join('\n')
}
