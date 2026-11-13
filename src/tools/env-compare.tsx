import { ConfigCompare } from '@/components/ConfigCompare'
import { envToMap } from '@/lib/env'

const A = 'APP_ENV=staging\nDATABASE_URL=postgres://localhost:5432/app\nDB_PASSWORD=hunter2\nAPI_KEY=abc123\nDEBUG=true\n'
const B = 'APP_ENV=production\nDATABASE_URL=postgres://db.prod:5432/app\nDB_PASSWORD=correct-horse\nAPI_KEY=abc123\nSENTRY_DSN=https://example.ingest.sentry.io/1\n'
export default function EnvCompare() {
  return <ConfigCompare parse={(t) => (t.trim() ? envToMap(t) : new Map())} sampleA={A} sampleB={B} labelA="Left .env" labelB="Right .env" accept=".env,.txt,text/plain" />
}
