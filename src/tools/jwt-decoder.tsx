import { useMemo, useState } from 'react'
import { Empty, Grid, InputPane, Notice, OutputPane, Panel, Stat } from '@/components/kit'
import { decodeJwt } from '@/lib/encode'
import { cn } from '@/lib/cn'

const CLAIMS: Record<string, string> = { iss: 'Issuer', sub: 'Subject', aud: 'Audience', exp: 'Expiration time', nbf: 'Not before', iat: 'Issued at', jti: 'JWT ID', scope: 'Scopes', azp: 'Authorized party', nonce: 'Nonce', email: 'Email', name: 'Name', roles: 'Roles' }
const TIME = new Set(['exp', 'nbf', 'iat', 'auth_time'])
const rel = (s: number) => { const a = Math.abs(s); const u = a >= 86400 ? [Math.floor(a / 86400), 'day'] : a >= 3600 ? [Math.floor(a / 3600), 'hour'] : a >= 60 ? [Math.floor(a / 60), 'minute'] : [a, 'second']; return `${u[0]} ${u[1]}${u[0] === 1 ? '' : 's'}` }
// Sample token (header {alg:HS256,typ:JWT}, payload with exp in 2001 → expired). Not a real credential.
const SAMPLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFkYSBMb3ZlbGFjZSIsImlzcyI6Imh0dHBzOi8vYXV0aC5leGFtcGxlLmNvbSIsImlhdCI6OTk5OTk5OTk5LCJleHAiOjk5OTk5OTk5OSwicm9sZXMiOlsiYWRtaW4iXX0.c2lnbmF0dXJlLW5vdC12ZXJpZmllZA'
export default function JwtDecoder() {
  const [t, setT] = useState('')
  const r = useMemo(() => { if (!t.trim()) return null; try { return { jwt: decodeJwt(t), err: '' } } catch (e) { return { jwt: null, err: (e as Error).message } } }, [t])
  const now = Math.floor(Date.now() / 1000)
  const p = (r?.jwt?.payload ?? {}) as Record<string, unknown>
  const exp = typeof p.exp === 'number' ? p.exp : undefined
  const alg = String(r?.jwt?.header.alg ?? '')
  return (
    <div className="flex flex-col gap-3">
      <Notice kind="warn">Decoding happens locally in your browser. <b>Do not paste production tokens or secrets</b> into any tool you do not control. This tool <b>does not verify signatures</b> — a decoded token is not necessarily a trustworthy one.</Notice>
      <div className="grid gap-3 lg:grid-cols-2">
        <InputPane title="Encoded token" value={t} onChange={setT} sample={SAMPLE} placeholder="eyJhbGciOi…" rows={10} />
        <div className="flex min-w-0 flex-col gap-3">
          {r?.err && <Notice kind="error">{r.err}</Notice>}
          {!r && <Empty>Paste a JWT to decode its header, payload and time-based claims.</Empty>}
          {r?.jwt && (
            <>
              <Grid cols={3}>
                <Stat label="Status" value={exp === undefined ? 'No expiry' : exp < now ? 'Expired' : 'Not expired'} tone={exp === undefined ? 'warn' : exp < now ? 'bad' : 'ok'} />
                <Stat label="Algorithm" value={alg || '—'} tone={/^none$/i.test(alg) ? 'bad' : undefined} /><Stat label="Signature" value="Not verified" tone="warn" />
              </Grid>
              {/^none$/i.test(alg) && <Notice kind="error">alg “none” means the token is unsigned. Servers must reject such tokens.</Notice>}
              {exp !== undefined && <Notice kind={exp < now ? 'error' : 'success'}>{exp < now ? `Expired ${rel(now - exp)} ago` : `Expires in ${rel(exp - now)}`} — {new Date(exp * 1000).toISOString()}</Notice>}
            </>
          )}
        </div>
      </div>
      {r?.jwt && (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            <OutputPane title="Header" value={JSON.stringify(r.jwt.header, null, 2)} rows={8} />
            <OutputPane title="Payload" value={JSON.stringify(r.jwt.payload, null, 2)} rows={8} />
          </div>
          <Panel title="Claims">
            <table className="w-full text-sm"><tbody>{Object.entries(p).map(([k, v]) => (
              <tr key={k} className="border-t align-top"><td className="mono w-28 py-1.5 pr-2 text-primary">{k}</td><td className="w-36 pr-2 text-xs text-muted-foreground">{CLAIMS[k] ?? ''}</td>
                <td className="mono break-all">{typeof v === 'object' ? JSON.stringify(v) : String(v)}
                  {TIME.has(k) && typeof v === 'number' && <div className={cn('text-xs', k === 'exp' && v < now ? 'text-destructive' : 'text-muted-foreground')}>{new Date(v * 1000).toLocaleString()} · {new Date(v * 1000).toISOString()} ({v < now ? `${rel(now - v)} ago` : `in ${rel(v - now)}`})</div>}</td></tr>))}</tbody></table>
          </Panel>
          <Panel title="Structure"><div className="mono break-all text-xs"><span className="text-destructive">{r.jwt.parts[0]}</span>.<span className="text-primary">{r.jwt.parts[1]}</span>.<span className="text-success">{r.jwt.parts[2]}</span></div><p className="mt-2 text-xs text-muted-foreground"><span className="text-destructive">Header</span> · <span className="text-primary">Payload</span> · <span className="text-success">Signature (base64url, {r.jwt.parts[2].length} chars)</span></p></Panel>
        </>
      )}
    </div>
  )
}
