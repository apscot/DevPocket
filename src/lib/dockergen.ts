import * as yaml from 'js-yaml'

export interface DockerfileOpts {
  kind: 'java-jar' | 'spring-boot' | 'node' | 'react' | 'static'
  build: 'maven' | 'gradle'; javaVersion: string; nodeVersion: string; baseImage: string; port: number; workdir: string
  multiStage: boolean; nonRoot: boolean; healthcheck: boolean; healthPath: string; env: string; buildCommand: string; startCommand: string; jvmOpts: string; pkgManager: 'npm' | 'yarn' | 'pnpm'
}
export function genDockerfile(o: DockerfileOpts): string {
  const L: string[] = []
  const env = o.env.split('\n').map((l) => l.trim()).filter(Boolean)
  const envLines = env.map((e) => { const [k, ...v] = e.split('='); if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) throw new Error(`Invalid environment variable name “${k}”.`); return `ENV ${k}=${JSON.stringify(v.join('='))}` })
  const wd = o.workdir || '/app'
  if (!Number.isInteger(o.port) || o.port < 1 || o.port > 65535) throw new Error('Port must be between 1 and 65535.')
  const nodeInstall = o.pkgManager === 'yarn' ? 'yarn install --frozen-lockfile' : o.pkgManager === 'pnpm' ? 'corepack enable && pnpm install --frozen-lockfile' : 'npm ci'
  const lock = o.pkgManager === 'yarn' ? 'yarn.lock' : o.pkgManager === 'pnpm' ? 'pnpm-lock.yaml' : 'package-lock.json'
  const run = (s: string) => (o.pkgManager === 'npm' ? `npm run ${s}` : `${o.pkgManager} ${s}`)
  const health = (cmd: string) => o.healthcheck ? [`HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \\`, `  CMD ${cmd}`] : []
  switch (o.kind) {
    case 'java-jar': case 'spring-boot': {
      const spring = o.kind === 'spring-boot'
      const jar = o.build === 'maven' ? 'target/*.jar' : 'build/libs/*.jar'
      if (o.multiStage) {
        const builder = o.baseImage && false ? o.baseImage : `${o.build === 'maven' ? 'maven:3.9-eclipse-temurin-' + o.javaVersion : 'gradle:8-jdk' + o.javaVersion}`
        L.push(`# ---- build stage ----`, `FROM ${builder} AS build`, `WORKDIR /workspace`)
        if (o.build === 'maven') L.push(`COPY pom.xml .`, `RUN mvn -B dependency:go-offline`, `COPY src ./src`, `RUN ${o.buildCommand || 'mvn -B clean package -DskipTests'}`)
        else L.push(`COPY build.gradle* settings.gradle* gradle.properties* ./`, `COPY gradle ./gradle`, `COPY src ./src`, `RUN ${o.buildCommand || 'gradle --no-daemon clean bootJar -x test'}`)
        L.push('', `# ---- runtime stage ----`, `FROM ${o.baseImage || `eclipse-temurin:${o.javaVersion}-jre`}`, `WORKDIR ${wd}`)
        if (o.nonRoot) L.push(`RUN addgroup --system app && adduser --system --ingroup app app`)
        L.push(`COPY --from=build /workspace/${jar} app.jar`)
      } else {
        L.push(`FROM ${o.baseImage || `eclipse-temurin:${o.javaVersion}-jre`}`, `WORKDIR ${wd}`)
        if (o.nonRoot) L.push(`RUN addgroup --system app && adduser --system --ingroup app app`)
        L.push(`# Build the jar first (${o.build === 'maven' ? 'mvn package' : 'gradle bootJar'}), then:`, `COPY ${jar} app.jar`)
      }
      L.push(...envLines)
      if (o.jvmOpts) L.push(`ENV JAVA_OPTS=${JSON.stringify(o.jvmOpts)}`)
      L.push(`EXPOSE ${o.port}`)
      if (o.nonRoot) L.push(`USER app`)
      if (spring && o.healthcheck) L.push(...health(`wget -qO- http://localhost:${o.port}${o.healthPath || '/actuator/health'} || exit 1`))
      else if (o.healthcheck) L.push(...health(`wget -qO- http://localhost:${o.port}${o.healthPath || '/'} || exit 1`))
      L.push(o.startCommand ? `ENTRYPOINT ${JSON.stringify(['sh', '-c', o.startCommand])}` : `ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]`)
      break
    }
    case 'node': {
      const img = o.baseImage || `node:${o.nodeVersion}-alpine`
      L.push(`FROM ${img}`, `WORKDIR ${wd}`, `ENV NODE_ENV=production`, ...envLines, `COPY package.json ${lock}* ./`, `RUN ${nodeInstall}${o.pkgManager === 'npm' ? ' --omit=dev' : ''}`, `COPY . .`)
      if (o.buildCommand) L.push(`RUN ${o.buildCommand}`)
      L.push(`EXPOSE ${o.port}`)
      if (o.nonRoot) L.push(`USER node`)
      L.push(...health(`wget -qO- http://localhost:${o.port}${o.healthPath || '/'} || exit 1`))
      L.push(`CMD ${JSON.stringify(['sh', '-c', o.startCommand || 'node index.js'])}`)
      break
    }
    case 'react': case 'static': {
      if (o.kind === 'react') {
        L.push(`# ---- build stage ----`, `FROM node:${o.nodeVersion}-alpine AS build`, `WORKDIR /app`, `COPY package.json ${lock}* ./`, `RUN ${nodeInstall}`, `COPY . .`, `RUN ${o.buildCommand || run('build')}`, '', `# ---- serve stage ----`)
        L.push(`FROM ${o.baseImage || 'nginx:alpine'}`, `COPY --from=build /app/dist /usr/share/nginx/html`)
      } else L.push(`FROM ${o.baseImage || 'nginx:alpine'}`, `COPY . /usr/share/nginx/html`)
      if (o.kind === 'react') L.push(`# SPA fallback: add your nginx.conf with "try_files $uri /index.html;" if you use client-side routing`, `# COPY nginx.conf /etc/nginx/conf.d/default.conf`)
      L.push(...envLines, `EXPOSE ${o.port === 8080 ? 80 : o.port}`, ...health(`wget -qO- http://localhost:${o.port === 8080 ? 80 : o.port}/ || exit 1`), `CMD ["nginx", "-g", "daemon off;"]`)
      break
    }
  }
  return L.join('\n') + '\n'
}

// ---------- Compose ----------
export interface ComposeService { name: string; image: string; ports: string; env: string; volumes: string; networks: string; dependsOn: string; command: string; restart: string; build?: string }
const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean)
export const COMPOSE_PRESETS: Record<string, ComposeService> = {
  app: { name: 'app', image: '', build: '.', ports: '8080:8080', env: 'SPRING_PROFILES_ACTIVE=docker', volumes: '', networks: 'backend', dependsOn: '', command: '', restart: 'unless-stopped' },
  postgres: { name: 'postgres', image: 'postgres:16-alpine', ports: '5432:5432', env: 'POSTGRES_DB=app\nPOSTGRES_USER=app\nPOSTGRES_PASSWORD=change-me', volumes: 'pgdata:/var/lib/postgresql/data', networks: 'backend', dependsOn: '', command: '', restart: 'unless-stopped' },
  mysql: { name: 'mysql', image: 'mysql:8.4', ports: '3306:3306', env: 'MYSQL_DATABASE=app\nMYSQL_USER=app\nMYSQL_PASSWORD=change-me\nMYSQL_ROOT_PASSWORD=change-me-too', volumes: 'mysqldata:/var/lib/mysql', networks: 'backend', dependsOn: '', command: '', restart: 'unless-stopped' },
  redis: { name: 'redis', image: 'redis:7-alpine', ports: '6379:6379', env: '', volumes: 'redisdata:/data', networks: 'backend', dependsOn: '', command: 'redis-server --appendonly yes', restart: 'unless-stopped' },
  zookeeper: { name: 'zookeeper', image: 'confluentinc/cp-zookeeper:7.6.1', ports: '2181:2181', env: 'ZOOKEEPER_CLIENT_PORT=2181\nZOOKEEPER_TICK_TIME=2000', volumes: '', networks: 'backend', dependsOn: '', command: '', restart: 'unless-stopped' },
  kafka: { name: 'kafka', image: 'confluentinc/cp-kafka:7.6.1', ports: '9092:9092', env: 'KAFKA_BROKER_ID=1\nKAFKA_ZOOKEEPER_CONNECT=zookeeper:2181\nKAFKA_ADVERTISED_LISTENERS=PLAINTEXT://kafka:29092,PLAINTEXT_HOST://localhost:9092\nKAFKA_LISTENER_SECURITY_PROTOCOL_MAP=PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT\nKAFKA_INTER_BROKER_LISTENER_NAME=PLAINTEXT\nKAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1', volumes: '', networks: 'backend', dependsOn: 'zookeeper', command: '', restart: 'unless-stopped' },
}
export function genCompose(services: ComposeService[], opts: { version?: boolean } = {}): string {
  if (!services.length) throw new Error('Add at least one service.')
  const names = new Set<string>()
  const vols = new Set<string>(), nets = new Set<string>()
  const svc: Record<string, Record<string, unknown>> = {}
  for (const s of services) {
    const n = s.name.trim()
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(n)) throw new Error(`Invalid service name “${n}”.`)
    if (names.has(n)) throw new Error(`Duplicate service name “${n}”.`)
    names.add(n)
    if (!s.image.trim() && !s.build?.trim()) throw new Error(`Service “${n}” needs an image or a build context.`)
    const o: Record<string, unknown> = {}
    if (s.image.trim()) o.image = s.image.trim()
    if (s.build?.trim()) o.build = s.build.trim()
    if (s.command.trim()) o.command = s.command.trim()
    const ports = lines(s.ports); if (ports.length) { ports.forEach((p) => { if (!/^(\d+(-\d+)?:)?\d+(-\d+)?(\/(tcp|udp))?$|^[\d.]+:\d+:\d+$/.test(p)) throw new Error(`Invalid port mapping “${p}” for ${n}.`) }); o.ports = ports }
    const env = lines(s.env); if (env.length) { const e: Record<string, string> = {}; env.forEach((l) => { const i = l.indexOf('='); if (i < 1) throw new Error(`Environment entry “${l}” for ${n} must be KEY=value.`); e[l.slice(0, i)] = l.slice(i + 1) }); o.environment = e }
    const v = lines(s.volumes); if (v.length) { o.volumes = v; v.forEach((x) => { const src = x.split(':')[0]; if (src && !/^[./~$]/.test(src) && !src.includes('/')) vols.add(src) }) }
    const nn = lines(s.networks.replace(/,/g, '\n')); if (nn.length) { o.networks = nn; nn.forEach((x) => nets.add(x)) }
    const dep = lines(s.dependsOn.replace(/,/g, '\n')); if (dep.length) o.depends_on = dep
    if (s.restart) o.restart = s.restart
    svc[n] = o
  }
  for (const [n, o] of Object.entries(svc)) for (const d of (o.depends_on as string[] | undefined) ?? []) if (!names.has(d)) throw new Error(`Service “${n}” depends on unknown service “${d}”.`)
  const doc: Record<string, unknown> = { services: svc }
  if (nets.size) doc.networks = Object.fromEntries([...nets].map((n) => [n, { driver: 'bridge' }]))
  if (vols.size) doc.volumes = Object.fromEntries([...vols].map((n) => [n, {}]))
  const out = yaml.dump(doc, { indent: 2, lineWidth: -1, noRefs: true })
  yaml.load(out) // validate generated YAML
  return (opts.version ? 'version: "3.9"\n' : '') + out
}

// ---------- GitHub Actions ----------
export interface GhaOpts {
  kind: 'maven' | 'gradle' | 'node' | 'react' | 'docker' | 'pages'; name: string; push: boolean; pr: boolean; dispatch: boolean; schedule: string; branches: string
  javaVersion: string; nodeVersion: string; cache: boolean; upload: boolean; matrix: boolean; runner: string; dockerImage: string; pushImage: boolean
}
export function genGha(o: GhaOpts): string {
  const branches = o.branches.split(',').map((b) => b.trim()).filter(Boolean)
  const on: Record<string, unknown> = {}
  if (o.push) on.push = branches.length ? { branches } : {}
  if (o.pr) on.pull_request = branches.length ? { branches } : {}
  if (o.dispatch) on.workflow_dispatch = {}
  if (o.schedule.trim()) { if (o.schedule.trim().split(/\s+/).length !== 5) throw new Error('Cron schedule must have 5 fields.'); on.schedule = [{ cron: o.schedule.trim() }] }
  if (!Object.keys(on).length) throw new Error('Select at least one trigger.')
  const steps: Record<string, unknown>[] = [{ uses: 'actions/checkout@v4' }]
  const doc: Record<string, unknown> = { name: o.name || 'CI', on }
  let jobs: Record<string, unknown>
  const runsOn = o.matrix ? '${{ matrix.os }}' : o.runner
  const strategy = o.matrix ? { strategy: { matrix: { os: ['ubuntu-latest', 'windows-latest', 'macos-latest'] } } } : {}
  switch (o.kind) {
    case 'maven': case 'gradle': {
      steps.push({ name: `Set up JDK ${o.javaVersion}`, uses: 'actions/setup-java@v4', with: { distribution: 'temurin', 'java-version': o.javaVersion, ...(o.cache ? { cache: o.kind } : {}) } })
      if (o.kind === 'gradle') steps.push({ name: 'Set up Gradle', uses: 'gradle/actions/setup-gradle@v4' })
      steps.push({ name: 'Build and test', run: o.kind === 'maven' ? 'mvn -B verify' : './gradlew build' })
      if (o.upload) steps.push({ name: 'Upload artifact', uses: 'actions/upload-artifact@v4', with: { name: 'app', path: o.kind === 'maven' ? 'target/*.jar' : 'build/libs/*.jar' } })
      jobs = { build: { 'runs-on': runsOn, ...strategy, steps } }; break
    }
    case 'node': case 'react': {
      steps.push({ name: `Use Node.js ${o.nodeVersion}`, uses: 'actions/setup-node@v4', with: { 'node-version': o.nodeVersion, ...(o.cache ? { cache: 'npm' } : {}) } }, { run: 'npm ci' })
      if (o.kind === 'react') steps.push({ run: 'npm run lint --if-present' }, { run: 'npm test --if-present' }, { name: 'Build', run: 'npm run build' })
      else steps.push({ run: 'npm run build --if-present' }, { run: 'npm test' })
      if (o.upload) steps.push({ name: 'Upload artifact', uses: 'actions/upload-artifact@v4', with: { name: 'dist', path: o.kind === 'react' ? 'dist' : 'build' } })
      jobs = { build: { 'runs-on': runsOn, ...strategy, steps } }; break
    }
    case 'docker': {
      const img = o.dockerImage || 'ghcr.io/${{ github.repository }}'
      steps.push({ name: 'Set up Docker Buildx', uses: 'docker/setup-buildx-action@v3' })
      if (o.pushImage) steps.push({ name: 'Log in to GHCR', uses: 'docker/login-action@v3', with: { registry: 'ghcr.io', username: '${{ github.actor }}', password: '${{ secrets.GITHUB_TOKEN }}' } })
      steps.push({ name: 'Build' + (o.pushImage ? ' and push' : ''), uses: 'docker/build-push-action@v6', with: { context: '.', push: o.pushImage, tags: `${img}:\${{ github.sha }}`, ...(o.cache ? { 'cache-from': 'type=gha', 'cache-to': 'type=gha,mode=max' } : {}) } })
      jobs = { docker: { 'runs-on': o.runner, ...(o.pushImage ? { permissions: { contents: 'read', packages: 'write' } } : {}), steps } }; break
    }
    case 'pages': {
      doc.permissions = { contents: 'read', pages: 'write', 'id-token': 'write' }
      doc.concurrency = { group: 'pages', 'cancel-in-progress': true }
      jobs = {
        build: { 'runs-on': o.runner, steps: [{ uses: 'actions/checkout@v4' }, { uses: 'actions/setup-node@v4', with: { 'node-version': o.nodeVersion, ...(o.cache ? { cache: 'npm' } : {}) } }, { run: 'npm ci' }, { run: 'npm run build' }, { uses: 'actions/upload-pages-artifact@v3', with: { path: 'dist' } }] },
        deploy: { needs: 'build', 'runs-on': o.runner, environment: { name: 'github-pages', url: '${{ steps.deployment.outputs.page_url }}' }, steps: [{ id: 'deployment', uses: 'actions/deploy-pages@v4' }] },
      }; break
    }
  }
  doc.jobs = jobs!
  const out = yaml.dump(doc, { indent: 2, lineWidth: -1, noRefs: true })
  yaml.load(out)
  return out.replace(/^'on':/m, 'on:') // js-yaml quotes the YAML 1.1 boolean-looking key
}

// ---------- GitHub Actions explain ----------
export interface WfStep { name: string; kind: 'uses' | 'run' | 'unknown'; detail: string; env: string[]; cond?: string; with?: Record<string, unknown> }
export interface WfJob { id: string; name: string; runsOn: string; needs: string[]; cond?: string; env: string[]; steps: WfStep[]; matrix?: string; environment?: string; permissions?: string; timeout?: number }
export interface Workflow { name: string; triggers: { event: string; detail: string }[]; env: string[]; permissions?: string; jobs: WfJob[]; order: string[][]; warnings: string[] }
const asArr = (v: unknown): string[] => (v === undefined || v === null ? [] : Array.isArray(v) ? v.map(String) : [String(v)])
export function explainWorkflow(text: string): Workflow {
  let d: any
  try { d = yaml.load(text) } catch (e) { throw new Error(`Invalid YAML: ${(e as Error).message}`) }
  if (!d || typeof d !== 'object') throw new Error('Workflow must be a YAML mapping.')
  const onRaw = d.on ?? d[true as unknown as string]
  if (onRaw === undefined) throw new Error('Missing required “on:” trigger section.')
  if (!d.jobs || typeof d.jobs !== 'object') throw new Error('Missing required “jobs:” section.')
  const warnings: string[] = []
  const triggers: Workflow['triggers'] = []
  const describe = (ev: string, cfg: any): string => {
    if (!cfg || typeof cfg !== 'object') return ''
    const parts: string[] = []
    if (cfg.branches) parts.push(`branches: ${asArr(cfg.branches).join(', ')}`); if (cfg['branches-ignore']) parts.push(`ignoring branches: ${asArr(cfg['branches-ignore']).join(', ')}`)
    if (cfg.tags) parts.push(`tags: ${asArr(cfg.tags).join(', ')}`); if (cfg.paths) parts.push(`paths: ${asArr(cfg.paths).join(', ')}`); if (cfg.types) parts.push(`types: ${asArr(cfg.types).join(', ')}`)
    if (ev === 'workflow_dispatch' && cfg.inputs) parts.push(`inputs: ${Object.keys(cfg.inputs).join(', ')}`)
    return parts.join(' · ')
  }
  if (typeof onRaw === 'string') triggers.push({ event: onRaw, detail: '' })
  else if (Array.isArray(onRaw)) onRaw.forEach((e) => triggers.push({ event: String(e), detail: '' }))
  else for (const [ev, cfg] of Object.entries(onRaw as object)) {
    if (ev === 'schedule' && Array.isArray(cfg)) cfg.forEach((c: any) => triggers.push({ event: 'schedule', detail: `cron ${c.cron}` }))
    else triggers.push({ event: ev, detail: describe(ev, cfg) })
  }
  const envKeys = (e: unknown) => (e && typeof e === 'object' ? Object.entries(e as object).map(([k, v]) => `${k}=${typeof v === 'string' && /secrets\./.test(v) ? '***secret***' : String(v)}`) : [])
  const jobs: WfJob[] = Object.entries(d.jobs as Record<string, any>).map(([id, j]) => {
    const steps: WfStep[] = (Array.isArray(j.steps) ? j.steps : []).map((s: any, i: number) => ({
      name: s.name ?? (s.uses ? s.uses : s.run ? String(s.run).split('\n')[0] : `Step ${i + 1}`), kind: s.uses ? 'uses' : s.run ? 'run' : 'unknown', detail: s.uses ?? s.run ?? '', env: envKeys(s.env), cond: s.if !== undefined ? String(s.if) : undefined, with: s.with,
    }))
    if (!j.uses && !steps.length) warnings.push(`Job “${id}” has no steps.`)
    if (!j['runs-on'] && !j.uses) warnings.push(`Job “${id}” is missing runs-on.`)
    for (const s of steps) if (s.kind === 'uses' && /@(main|master)$/.test(s.detail)) warnings.push(`Job “${id}”: ${s.detail} is pinned to a branch; pin to a version or SHA.`)
    for (const s of steps) if (s.kind === 'uses' && !s.detail.includes('@') && !s.detail.startsWith('./') && !s.detail.startsWith('docker://')) warnings.push(`Job “${id}”: ${s.detail} has no @version.`)
    return { id, name: j.name ?? id, runsOn: Array.isArray(j['runs-on']) ? j['runs-on'].join(', ') : typeof j['runs-on'] === 'object' && j['runs-on'] ? JSON.stringify(j['runs-on']) : String(j['runs-on'] ?? (j.uses ? `reusable: ${j.uses}` : '—')), needs: asArr(j.needs), cond: j.if !== undefined ? String(j.if) : undefined, env: envKeys(j.env), steps, matrix: j.strategy?.matrix ? JSON.stringify(j.strategy.matrix) : undefined, environment: j.environment ? (typeof j.environment === 'string' ? j.environment : j.environment.name) : undefined, permissions: j.permissions ? JSON.stringify(j.permissions) : undefined, timeout: j['timeout-minutes'] }
  })
  const ids = new Set(jobs.map((j) => j.id))
  for (const j of jobs) for (const n of j.needs) if (!ids.has(n)) warnings.push(`Job “${j.id}” needs unknown job “${n}”.`)
  // topological levels
  const level = new Map<string, number>(); const lv = (id: string, seen: string[] = []): number => {
    if (level.has(id)) return level.get(id)!
    if (seen.includes(id)) { warnings.push(`Circular dependency involving “${id}”.`); return 0 }
    const j = jobs.find((x) => x.id === id); const l = j && j.needs.length ? 1 + Math.max(...j.needs.filter((n) => ids.has(n)).map((n) => lv(n, [...seen, id])), -1) : 0
    level.set(id, l); return l
  }
  jobs.forEach((j) => lv(j.id))
  const order: string[][] = []; jobs.forEach((j) => { const l = level.get(j.id)!; (order[l] ??= []).push(j.id) })
  return { name: d.name ?? '(unnamed workflow)', triggers, env: envKeys(d.env), permissions: d.permissions ? JSON.stringify(d.permissions) : undefined, jobs, order: order.filter(Boolean), warnings }
}

// ---------- CIDR ----------
export interface CidrInfo { cidr: string; ip: string; prefix: number; mask: string; wildcard: string; network: string; broadcast: string; first: string; last: string; hosts: number; total: number; ipClass: string; isPrivate: boolean; binaryMask: string; ipBinary: string }
const toInt = (p: number[]) => ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0
const toIp = (n: number) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.')
export function parseIPv4(s: string): number[] {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s.trim())
  if (!m) throw new Error(`“${s}” is not a valid IPv4 address.`)
  const p = m.slice(1).map(Number); if (p.some((x) => x > 255)) throw new Error('Each octet must be 0–255.'); return p
}
export function calcCidr(input: string): CidrInfo {
  const t = input.trim()
  let ip: string, prefix: number
  const m = /^([\d.]+)\s*\/\s*(\d{1,2}|[\d.]+)$/.exec(t)
  if (!m) { ip = t; prefix = 32 } else { ip = m[1]; if (m[2].includes('.')) { const mi = toInt(parseIPv4(m[2])); const bin = mi.toString(2).padStart(32, '0'); if (!/^1*0*$/.test(bin)) throw new Error('Subnet mask must be contiguous (e.g. 255.255.255.0).'); prefix = bin.indexOf('0') < 0 ? 32 : bin.indexOf('0') } else prefix = Number(m[2]) }
  if (prefix < 0 || prefix > 32) throw new Error('Prefix length must be between 0 and 32.')
  const p = parseIPv4(ip); const n = toInt(p)
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
  const net = (n & mask) >>> 0, bc = (net | (~mask >>> 0)) >>> 0
  const total = 2 ** (32 - prefix)
  const hosts = prefix >= 31 ? (prefix === 32 ? 1 : 2) : total - 2
  const first = prefix >= 31 ? net : net + 1, last = prefix >= 31 ? bc : bc - 1
  const f = p[0]
  return { cidr: `${toIp(net)}/${prefix}`, ip: toIp(n), prefix, mask: toIp(mask), wildcard: toIp(~mask >>> 0), network: toIp(net), broadcast: toIp(bc), first: toIp(first), last: toIp(last), hosts, total, ipClass: f < 128 ? 'A' : f < 192 ? 'B' : f < 224 ? 'C' : f < 240 ? 'D (multicast)' : 'E (reserved)', isPrivate: f === 10 || (f === 172 && p[1] >= 16 && p[1] <= 31) || (f === 192 && p[1] === 168), binaryMask: toIp(mask).split('.').map((x) => Number(x).toString(2).padStart(8, '0')).join('.'), ipBinary: p.map((x) => x.toString(2).padStart(8, '0')).join('.') }
}
export function splitSubnet(input: string, newPrefix: number, limit = 256): string[] {
  const c = calcCidr(input)
  if (newPrefix <= c.prefix || newPrefix > 32) throw new Error(`New prefix must be larger than /${c.prefix} and at most /32.`)
  const count = 2 ** (newPrefix - c.prefix); const size = 2 ** (32 - newPrefix); const base = toInt(parseIPv4(c.network))
  return Array.from({ length: Math.min(count, limit) }, (_, i) => `${toIp((base + i * size) >>> 0)}/${newPrefix}`)
}
