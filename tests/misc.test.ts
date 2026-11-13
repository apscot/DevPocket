import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import * as yaml from 'js-yaml'
import { CATEGORIES, TOOLS, searchTools, toolById } from '@/registry'
import { COMPOSE_PRESETS, calcCidr, explainWorkflow, genCompose, genDockerfile, genGha, splitSubnet } from '@/lib/dockergen'
import { genGitignore, GITIGNORE } from '@/lib/gitignore'
import { DOCKER, GIT, K8S, MYSQL, POSTGRES, TAR, DU } from '@/lib/commands'
import { CASES, asciiTree, cleanClipboard, cleanInvisible, convertCase, dedupeLines, fillTemplate, findInvisible, parseKv, placeholders, textToolbox, toMarkdownTable, visualize, wordStats } from '@/lib/text'
import { groupKey, normalizeLogLine, parseLogs, parseTimestamp } from '@/lib/logs'
import { SNOWFLAKE_PRESETS, composeSnowflake, dateDiff, decodeSnowflake, detectEpoch, explainCron, isoInTz, nextRuns, parseCron, tzOffsetMinutes, zonedToUtc, cssToPx, pxToCss } from '@/lib/datetime'
import { contrastRatio, hslToRgb, luminance, palette, parseColor, rgbToHsl, suggestForeground, toHex, toHslString, toRgbString, wcag } from '@/lib/color'
import { explainRegex } from '@/lib/regexExplain'

describe('Registry', () => {
  it('contains exactly 103 unique, available tools with valid metadata', () => {
    expect(TOOLS).toHaveLength(103)
    expect(new Set(TOOLS.map((t) => t.id)).size).toBe(103)
    for (const t of TOOLS) {
      expect(t.status, t.id).toBe('available'); expect(t.route).toBe(`/tools/${t.id}`); expect(CATEGORIES.some((c) => c.id === t.category), t.id).toBe(true)
      expect(t.name && t.description && t.icon && t.tags.length, t.id).toBeTruthy()
    }
  })
  it('every registered tool has an implementation file and no orphan files exist', () => {
    const files = fs.readdirSync('src/tools').map((f) => f.replace('.tsx', ''))
    expect(files.sort()).toEqual(TOOLS.map((t) => t.id).sort())
    for (const id of files) expect(fs.readFileSync(`src/tools/${id}.tsx`, 'utf8')).toMatch(/export default/)
  })
  it('category counts match the spec', () => {
    const n = (c: string) => TOOLS.filter((t) => t.category === c).length
    expect([n('data'), n('java'), n('security'), n('devops'), n('text'), n('datetime'), n('visual'), n('browser')]).toEqual([23, 12, 12, 15, 15, 9, 10, 7])
  })
  it('search matches name, description and tags and filters by category', () => {
    expect(searchTools('jwt')[0].id).toBe('jwt-decoder'); expect(searchTools('kubectl').map((t) => t.id)).toContain('kubectl-cheatsheet'); expect(searchTools('yaml', 'java').every((t) => t.category === 'java')).toBe(true)
    expect(searchTools('zzzzqqq')).toHaveLength(0); expect(searchTools('')).toHaveLength(103); expect(toolById('json-diff')?.name).toBe('JSON Diff')
  })
})

describe('Generators: Docker, Compose, GitHub Actions, .gitignore', () => {
  const base = { kind: 'spring-boot' as const, build: 'maven' as const, javaVersion: '21', nodeVersion: '20', baseImage: '', port: 8080, workdir: '/app', multiStage: true, nonRoot: true, healthcheck: true, healthPath: '', env: 'A=1', buildCommand: '', startCommand: '', jvmOpts: '-Xmx1g', pkgManager: 'npm' as const }
  it('generates Dockerfiles for every application type', () => {
    const d = genDockerfile(base)
    expect(d).toMatch(/^# ---- build stage ----\nFROM maven:3\.9-eclipse-temurin-21 AS build/); expect(d).toContain('FROM eclipse-temurin:21-jre'); expect(d).toContain('EXPOSE 8080'); expect(d).toContain('USER app'); expect(d).toContain('/actuator/health'); expect(d).toContain('ENV A="1"')
    expect(genDockerfile({ ...base, build: 'gradle' })).toContain('build/libs/*.jar')
    expect(genDockerfile({ ...base, kind: 'node', port: 3000 })).toMatch(/FROM node:20-alpine[\s\S]*npm ci --omit=dev[\s\S]*USER node/)
    expect(genDockerfile({ ...base, kind: 'react', port: 80 })).toMatch(/AS build[\s\S]*npm run build[\s\S]*FROM nginx:alpine[\s\S]*\/usr\/share\/nginx\/html/)
    expect(genDockerfile({ ...base, kind: 'static', port: 80 })).toContain('COPY . /usr/share/nginx/html')
    expect(genDockerfile({ ...base, kind: 'java-jar', multiStage: false })).toContain('COPY target/*.jar app.jar')
  })
  it('validates Dockerfile options', () => { expect(() => genDockerfile({ ...base, port: 70000 })).toThrow(/Port/); expect(() => genDockerfile({ ...base, env: 'bad name=1' })).toThrow(/Invalid environment/) })
  it('generates valid Compose YAML with volumes/networks and checks dependencies', () => {
    const out = genCompose([{ ...COMPOSE_PRESETS.app, dependsOn: 'postgres' }, COMPOSE_PRESETS.postgres, COMPOSE_PRESETS.redis, COMPOSE_PRESETS.zookeeper, COMPOSE_PRESETS.kafka, COMPOSE_PRESETS.mysql])
    const doc = yaml.load(out) as any
    expect(Object.keys(doc.services)).toEqual(['app', 'postgres', 'redis', 'zookeeper', 'kafka', 'mysql']); expect(doc.services.app.depends_on).toEqual(['postgres']); expect(Object.keys(doc.volumes).sort()).toEqual(['mysqldata', 'pgdata', 'redisdata']); expect(doc.networks.backend.driver).toBe('bridge'); expect(doc.services.postgres.environment.POSTGRES_DB).toBe('app')
    expect(() => genCompose([{ ...COMPOSE_PRESETS.app, dependsOn: 'nope' }])).toThrow(/unknown service/); expect(() => genCompose([COMPOSE_PRESETS.redis, COMPOSE_PRESETS.redis])).toThrow(/Duplicate/); expect(() => genCompose([])).toThrow(); expect(() => genCompose([{ ...COMPOSE_PRESETS.redis, ports: 'abc' }])).toThrow(/port/)
  })
  const g = { kind: 'maven' as const, name: 'CI', push: true, pr: true, dispatch: false, schedule: '', branches: 'main', javaVersion: '21', nodeVersion: '20', cache: true, upload: false, matrix: false, runner: 'ubuntu-latest', dockerImage: '', pushImage: false }
  it('generates valid workflows for each type and round-trips through the explainer', () => {
    for (const kind of ['maven', 'gradle', 'node', 'react', 'docker', 'pages'] as const) {
      const out = genGha({ ...g, kind, pushImage: kind === 'docker' }); const w = explainWorkflow(out)
      expect(w.jobs.length, kind).toBeGreaterThan(0); expect(w.triggers.map((t) => t.event), kind).toContain('push'); expect(w.warnings, kind).toEqual([])
    }
    expect(genGha(g)).toMatch(/^name: CI\non:\n {2}push:\n {4}branches:\n {6}- main/); expect(genGha(g)).toContain("java-version: '21'")
    expect(() => genGha({ ...g, push: false, pr: false })).toThrow(/trigger/); expect(() => genGha({ ...g, schedule: '* *' })).toThrow(/5 fields/)
    const pages = explainWorkflow(genGha({ ...g, kind: 'pages' })); expect(pages.order).toEqual([['build'], ['deploy']]); expect(pages.jobs[1].needs).toEqual(['build'])
  })
  it('explains workflow structure, env masking and problems', () => {
    const w = explainWorkflow(`name: X\non: [push, pull_request]\nenv:\n  K: v\njobs:\n  a:\n    runs-on: ubuntu-latest\n    env:\n      T: \${{ secrets.T }}\n    steps:\n      - uses: actions/checkout@main\n      - run: echo hi\n  b:\n    needs: [a, ghost]\n    steps: []\n`)
    expect(w.triggers.map((t) => t.event)).toEqual(['push', 'pull_request']); expect(w.jobs[0].env[0]).toBe('T=***secret***'); expect(w.warnings.join('|')).toMatch(/pinned to a branch/); expect(w.warnings.join('|')).toMatch(/unknown job “ghost”/); expect(w.warnings.join('|')).toMatch(/missing runs-on/)
    expect(() => explainWorkflow('name: x')).toThrow(/“on:”/); expect(() => explainWorkflow('on: push')).toThrow(/jobs/); expect(() => explainWorkflow(': : :')).toThrow()
  })
  it('combines .gitignore templates without duplicate patterns', () => {
    const out = genGitignore(['java', 'maven', 'intellij', 'macos']); expect(out).toContain('# Maven'); expect(out).toContain('.idea/'); expect(out).toContain('.DS_Store')
    expect(out.split('\n').filter((l) => l === 'target/').length).toBe(1); expect(Object.keys(GITIGNORE)).toEqual(expect.arrayContaining(['java', 'springboot', 'intellij', 'vscode', 'maven', 'gradle', 'node', 'react', 'macos', 'windows', 'docker']))
  })
})

describe('CIDR', () => {
  it('calculates subnet details', () => {
    const c = calcCidr('192.168.10.37/24'); expect(c).toMatchObject({ network: '192.168.10.0', broadcast: '192.168.10.255', first: '192.168.10.1', last: '192.168.10.254', mask: '255.255.255.0', wildcard: '0.0.0.255', hosts: 254, total: 256, isPrivate: true, ipClass: 'C', cidr: '192.168.10.0/24' })
    expect(calcCidr('10.0.0.0/8').hosts).toBe(16777214); expect(calcCidr('172.16.5.4/255.255.0.0').prefix).toBe(16); expect(calcCidr('10.0.0.1/31').hosts).toBe(2); expect(calcCidr('10.0.0.1/32').hosts).toBe(1); expect(calcCidr('8.8.8.8/0').network).toBe('0.0.0.0'); expect(calcCidr('8.8.8.8').isPrivate).toBe(false)
  })
  it('validates input', () => { for (const bad of ['300.1.1.1/24', '1.2.3/24', '1.2.3.4/33', 'abc', '1.2.3.4/255.0.255.0']) expect(() => calcCidr(bad), bad).toThrow() })
  it('splits subnets', () => { expect(splitSubnet('10.0.0.0/24', 26)).toEqual(['10.0.0.0/26', '10.0.0.64/26', '10.0.0.128/26', '10.0.0.192/26']); expect(() => splitSubnet('10.0.0.0/24', 24)).toThrow() })
})

describe('Command generators', () => {
  const run = (list: typeof DOCKER, id: string, v: Record<string, unknown> = {}) => { const r = list.find((x) => x.id === id)!; return r.build({ ...Object.fromEntries(r.fields.map((f) => [f.key, f.default ?? (f.type === 'check' ? false : '')])), ...v }) }
  it('builds Docker commands with escaping', () => {
    expect(run(DOCKER, 'run')).toBe('docker run -d --name web -p 8080:80 nginx:latest'); expect(run(DOCKER, 'run', { env: "A=it's,B=2" })).toContain(`-e 'A=it'\\''s' -e B=2`)
    expect(run(DOCKER, 'exec', { cmd: 'sh -c "ls"' })).toBe('docker exec -it web sh -c "ls"'); expect(run(DOCKER, 'build')).toBe('docker build -t myapp:latest .'); expect(run(DOCKER, 'logs')).toBe('docker logs -f --tail 100 web'); expect(run(DOCKER, 'net-create')).toBe('docker network create --driver bridge backend')
  })
  it('builds tar, du, git, kubectl, mysql and postgres commands', () => {
    expect(run(TAR, 'create')).toBe('tar -czvf backup.tar.gz --exclude=node_modules --exclude=\'*.log\' --exclude=.git ./project'); expect(run(TAR, 'create', { comp: 'zst' })).toContain('tar --zstd -cf backup.tar.zst'); expect(run(TAR, 'extract')).toBe('tar -xvf backup.tar.gz -C ./restore')
    expect(run(DU, 'summary')).toBe('du -sh .'); expect(run(DU, 'largest', { os: 'gnu' })).toBe('du -h -d 1 . | sort -rh | head -n 10')
    expect(run(GIT, 'branch-new')).toBe('git switch -c feature/login'); expect(run(GIT, 'reset-hard')).toBe('git reset --hard origin/main'); expect(GIT.find((r) => r.id === 'reset-hard')!.danger).toMatch(/discards/i); expect(run(GIT, 'push', { force: '--force-with-lease', u: true })).toBe('git push -u --force-with-lease origin main')
    expect(run(K8S, 'logs')).toBe('kubectl logs -f --tail=100 my-pod'); expect(run(K8S, 'get', { all: true })).toBe('kubectl get pods -A')
    expect(run(MYSQL, 'create-db')).toBe('CREATE DATABASE IF NOT EXISTS `app` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;'); expect(run(MYSQL, 'create-user')).toContain("CREATE USER 'app'@'%' IDENTIFIED BY 'change-me';"); expect(run(MYSQL, 'update')).toContain('WHERE id = 42')
    expect(run(POSTGRES, 'create-db')).toBe('CREATE DATABASE "app" OWNER "app" ENCODING \'UTF8\';'); expect(run(POSTGRES, 'index')).toContain('CREATE INDEX CONCURRENTLY "idx_users_email" ON "users" USING btree ("email");'); expect(run(POSTGRES, 'create-role', { user: 'a"b' })).toContain('"a""b"')
  })
  it('protects against SQL identifier / literal injection in generated statements', () => { expect(run(MYSQL, 'create-user', { pass: "x'; DROP" })).toContain("'x''; DROP'") ; expect(run(MYSQL, 'drop-db', { name: 'a`b' })).toBe('DROP DATABASE `a``b`;') })
  it('marks destructive commands', () => { for (const [l, id] of [[GIT, 'clean'], [DOCKER, 'prune'], [K8S, 'delete'], [MYSQL, 'drop-db'], [POSTGRES, 'truncate']] as const) expect((l as typeof DOCKER).find((r) => r.id === id)!.danger, id).toBeTruthy() })
  it('has a meaningful number of recipes', () => { expect([DOCKER, TAR, DU, GIT, K8S, MYSQL, POSTGRES].every((l) => l.length >= 6)).toBe(true); expect(K8S.length).toBeGreaterThanOrEqual(15) })
})

describe('Text utilities', () => {
  it('converts case styles', () => {
    const m = Object.fromEntries(CASES.map(([k]) => [k, convertCase('XMLHttpRequest user_id-value', k)]))
    expect(m.camel).toBe('xmlHttpRequestUserIdValue'); expect(m.pascal).toBe('XmlHttpRequestUserIdValue'); expect(m.snake).toBe('xml_http_request_user_id_value'); expect(m.kebab).toBe('xml-http-request-user-id-value'); expect(m.constant).toBe('XML_HTTP_REQUEST_USER_ID_VALUE'); expect(m.sentence).toBe('Xml http request user id value')
    expect(convertCase('the lord of the rings', 'title')).toBe('The Lord of the Rings'); expect(convertCase('', 'camel')).toBe('')
  })
  it('toolbox operations', () => {
    expect(textToolbox('  b \n a\n\n\n  c', { trimLines: true, removeBlank: true, sort: 'asc' })).toBe('a\nb\nc'); expect(textToolbox('b\na\nB', { sort: 'asc', sortIgnoreCase: true, unique: true })).toBe('a\nb'); expect(textToolbox('abc\ndef', { reverse: 'chars' })).toBe('cba\nfed'); expect(textToolbox('a\nb', { reverse: 'lines', numberLines: true, prefix: '- ' })).toBe('- 1  b\n- 2  a')
    expect(textToolbox('a  b', { collapseSpaces: true })).toBe('a b'); expect(textToolbox('Café', { stripAccents: true })).toBe('Cafe'); expect(textToolbox('a\nb\nc', { join: ', ' })).toBe('a, b, c'); expect(textToolbox('10\n9\n100', { sort: 'natural' })).toBe('9\n10\n100'); expect(textToolbox('aaa bbb ccc', { wrap: 7 })).toBe('aaa bbb\nccc')
  })
  it('deduplicates lines and reports counts', () => {
    const r = dedupeLines('a\nA\na\n\nb\nb ', { ignoreCase: true, trim: true }); expect(r.text).toBe('a\nb'); expect(r.removed).toBe(3); expect(r.unique).toBe(2)
    expect(dedupeLines('x\ny\nx', { sort: 'desc' }).text).toBe('y\nx'); expect(dedupeLines('x\ny\nx', { onlyDuplicates: true, counts: true }).text).toBe('2\tx'); expect(dedupeLines('a\n\na', { keepEmpty: true }).unique).toBe(2)
  })
  it('counts words, sentences and paragraphs', () => { const s = wordStats('Hello world. How are you?\n\nSecond paragraph!'); expect(s).toMatchObject({ words: 7, sentences: 3, paragraphs: 2, lines: 3 }) })
  it('detects, visualizes and cleans invisible characters', () => {
    const t = 'a\u200bb\u00a0c\tx\r\ny\n'; const r = findInvisible(t)
    expect(r.found.map((f) => f.label)).toEqual(['ZWSP', 'NBSP', 'TAB']); expect(r.eol).toEqual({ lf: 1, crlf: 1, cr: 0 }); expect(r.found[0]).toMatchObject({ line: 1, col: 2 })
    expect(cleanInvisible(t, { normalizeEol: 'lf' })).toBe('ab c\tx\ny\n'); expect(cleanInvisible('a\u00a0b', { keepNbsp: true })).toBe('a\u00a0b'); expect(visualize('a b\u200b\t')).toContain('⟦ZWSP⟧'); expect(visualize('a b')).toContain('·')
  })
  it('cleans clipboard text', () => {
    expect(cleanClipboard('  “Hi”  —  <b>x</b>\u200b  \n\n\n\n y ', { stripHtml: true, straightQuotes: true, collapseSpaces: true, trimLines: true, collapseBlank: true, removeInvisible: true })).toBe('"Hi" - x\n\ny')
    expect(cleanClipboard('• a\n• b', { stripBullets: true, joinLines: true })).toBe('a b'); expect(cleanClipboard('**b** `c` [l](u)', { stripMarkdown: true })).toBe('b c l')
  })
  it('fills templates', () => {
    expect(fillTemplate('Hi {{ name }}, {{x}}', { name: 'Ada' }, 'mustache')).toMatchObject({ out: 'Hi Ada, {{x}}', missing: ['x'] }); expect(fillTemplate('${a}-${b}', { a: '1', b: '2', c: '3' }, 'dollar')).toMatchObject({ out: '1-2', unused: ['c'] })
    expect(fillTemplate('%a%', {}, 'percent', 'empty').out).toBe(''); expect(() => fillTemplate('{{a}}', {}, 'mustache', 'error')).toThrow(/Missing/); expect(placeholders('{{a}} {{b}} {{a}}', 'mustache')).toEqual(['a', 'b'])
    expect(parseKv('a=1\n# c\nb: two')).toEqual({ a: '1', b: 'two' }); expect(parseKv('{"a":1}')).toEqual({ a: '1' }); expect(() => parseKv('oops')).toThrow()
  })
  it('builds markdown tables with alignment and escaping', () => {
    expect(toMarkdownTable([['Name', 'Qty'], ['a|b', '5']], { align: ['l', 'r'] })).toBe('| Name | Qty |\n| :--- | --: |\n| a\\|b |   5 |'); expect(toMarkdownTable([['x', 'y']], { header: false, pretty: false })).toContain('| Column 1 | Column 2 |'); expect(toMarkdownTable([['a', 'b'], ['1', '2']], { align: ['c', 'c'] })).toContain(':-:')
  })
  it('renders directory trees from paths and indented outlines', () => {
    const t = asciiTree('src/a.ts\nsrc/b/c.ts\nREADME.md\nnode_modules/x/y.js', { root: 'proj', exclude: 'node_modules', dirsFirst: true })
    expect(t).toBe('proj/\n├── src/\n│   ├── b/\n│   │   └── c.ts\n│   └── a.ts\n└── README.md'); expect(asciiTree('a/b.txt', { style: 'ascii', root: '.' })).toBe('.\n`-- a/\n    `-- b.txt'); expect(asciiTree('app\n  src\n    main.ts\n  pom.xml', { root: 'r' })).toContain('└── app/'); expect(asciiTree('a/b/c/d.txt', { maxDepth: 2, root: 'r' })).not.toContain('d.txt')
  })
})

describe('Logs', () => {
  const log = `2024-03-11 10:15:42.123 ERROR 4121 --- [nio-8080-exec-3] c.e.UserController : Failed id=42\njava.lang.IllegalStateException: boom\n\tat a.B.c(B.java:1)\n2024-03-11 10:15:43.001 WARN 4121 --- [main] c.e.Svc : Slow 1532 ms\n2024-03-11T10:15:44Z INFO started`
  it('parses entries with levels, continuation lines and timestamps', () => {
    const e = parseLogs(log); expect(e.map((x) => x.level)).toEqual(['ERROR', 'WARN', 'INFO']); expect(e[0].lines).toBe(3); expect(e[0].thread).toBe('nio-8080-exec-3'); expect(e[0].message).toContain('boom'); expect(e[0].tsMs).toBe(Date.UTC(2024, 2, 11, 10, 15, 42, 123)); expect(e[2].tsMs).toBe(Date.UTC(2024, 2, 11, 10, 15, 44))
  })
  it('groups repeated messages and normalizes lines for comparison', () => {
    expect(groupKey('Slow request took 1532 ms for 10.0.0.1:80 id 8c1e6b9a-3f1c-4a0e-9f6f-2f2d1c3b7a11')).toBe('Slow request took <n> ms for <ip> id <uuid>')
    expect(normalizeLogLine('2024-03-11 10:00:01.100 INFO [pool-1-thread-2] x 10.0.0.5:5432', { timestamps: true, threads: true, ips: true, whitespace: true })).toBe('<ts> INFO [<thread>] x <ip>')
  })
  it('parses timestamp formats', () => {
    expect(parseTimestamp('2024-03-11 10:15:42,123')).toBe(Date.UTC(2024, 2, 11, 10, 15, 42, 123)); expect(parseTimestamp('2024-03-11T10:15:42+02:00')).toBe(Date.UTC(2024, 2, 11, 8, 15, 42)); expect(parseTimestamp('11/Mar/2024:10:15:42 +0000')).toBe(Date.UTC(2024, 2, 11, 10, 15, 42)); expect(parseTimestamp('1710152142123')).toBe(1710152142123); expect(parseTimestamp('garbage')).toBeUndefined()
  })
})

describe('Date & time', () => {
  it('detects epoch units', () => { expect(detectEpoch(1710152142n)).toEqual({ unit: 's', ms: 1710152142000 }); expect(detectEpoch(1710152142123n)?.unit).toBe('ms'); expect(detectEpoch(1710152142123456n)?.unit).toBe('us'); expect(detectEpoch(1710152142123456789n)?.unit).toBe('ns'); expect(detectEpoch(123456789012n)).toBeNull() })
  it('handles time zones and DST transitions', () => {
    const jan = Date.UTC(2024, 0, 15, 12), jul = Date.UTC(2024, 6, 15, 12)
    expect(tzOffsetMinutes(jan, 'America/New_York')).toBe(-300); expect(tzOffsetMinutes(jul, 'America/New_York')).toBe(-240); expect(tzOffsetMinutes(jan, 'Asia/Kolkata')).toBe(330); expect(tzOffsetMinutes(jul, 'UTC')).toBe(0); expect(tzOffsetMinutes(jan, 'Europe/Berlin')).toBe(60); expect(tzOffsetMinutes(jul, 'Europe/Berlin')).toBe(120)
    expect(new Date(zonedToUtc(2024, 7, 1, 9, 0, 0, 0, 'America/New_York')).toISOString()).toBe('2024-07-01T13:00:00.000Z'); expect(new Date(zonedToUtc(2024, 12, 1, 9, 0, 0, 0, 'America/New_York')).toISOString()).toBe('2024-12-01T14:00:00.000Z')
    expect(new Date(zonedToUtc(2024, 3, 10, 2, 30, 0, 0, 'America/New_York')).toISOString()).toBe('2024-03-10T07:30:00.000Z') // non-existent local time (spring forward) → shifted forward
    expect(isoInTz(Date.UTC(2024, 6, 1, 13), 'America/New_York')).toBe('2024-07-01T09:00:00.000-04:00'); expect(isoInTz(0, 'UTC')).toBe('1970-01-01T00:00:00.000Z')
  })
  it('computes calendar differences', () => {
    const d = (s: string) => new Date(s + 'Z')
    expect(dateDiff(d('2024-01-31T00:00:00'), d('2024-03-01T00:00:00'))).toMatchObject({ years: 0, months: 1, days: 1 })
    expect(dateDiff(d('2020-02-29T10:30:00'), d('2024-02-29T12:45:00'))).toMatchObject({ years: 4, months: 0, days: 0, hours: 2, minutes: 15 })
    expect(dateDiff(d('2024-01-01T00:00:00'), d('2024-01-01T00:00:00'), true).totalDays).toBe(1); expect(dateDiff(d('2024-03-01T00:00:00'), d('2024-01-01T00:00:00')).negative).toBe(true); expect(dateDiff(d('2024-01-01T00:00:00'), d('2025-01-01T00:00:00')).totalDays).toBe(366)
  })
  it('parses and explains cron expressions', () => {
    expect(explainCron(parseCron('*/15 9-17 * * 1-5', 'unix'))).toBe('Every 15 minutes, between 09:00 and 17:59, Monday through Friday'); expect(explainCron(parseCron('0 0 * * *', 'unix'))).toBe('At 00:00'); expect(explainCron(parseCron('* * * * *', 'unix'))).toBe('Every minute'); expect(explainCron(parseCron('*/5 * * * *', 'unix'))).toBe('Every 5 minutes')
    expect(explainCron(parseCron('0 0 23 L * ?', 'quartz'))).toContain('last day of the month'); expect(explainCron(parseCron('0 0 10 ? * 6#2', 'quartz'))).toContain('2nd Friday')
    expect(() => parseCron('* * * *', 'unix')).toThrow(/5 fields/); expect(() => parseCron('61 * * * *', 'unix')).toThrow(/range/); expect(() => parseCron('* * * * * *', 'unix')).toThrow(); expect(() => parseCron('*/0 * * * *', 'unix')).toThrow(/step/); expect(() => parseCron('* * * * FOO', 'unix')).toThrow()
  })
  it('computes upcoming executions', () => {
    const from = new Date(Date.UTC(2024, 0, 31, 23, 50)) // Wed
    const r = nextRuns(parseCron('0 9 * * 1-5', 'unix'), from, 3, 'utc'); expect(r.map((d) => d.toISOString())).toEqual(['2024-02-01T09:00:00.000Z', '2024-02-02T09:00:00.000Z', '2024-02-05T09:00:00.000Z'])
    expect(nextRuns(parseCron('*/20 * * * *', 'unix'), new Date(Date.UTC(2024, 0, 1, 0, 0)), 3, 'utc').map((d) => d.getUTCMinutes())).toEqual([20, 40, 0])
    expect(nextRuns(parseCron('0 0 0 L * ?', 'quartz'), new Date(Date.UTC(2024, 1, 1)), 2, 'utc').map((d) => d.toISOString().slice(0, 10))).toEqual(['2024-02-29', '2024-03-31'])
    expect(nextRuns(parseCron('0 0 10 ? * 6#2', 'quartz'), new Date(Date.UTC(2024, 0, 1)), 2, 'utc').map((d) => d.toISOString().slice(0, 10))).toEqual(['2024-01-12', '2024-02-09'])
    expect(nextRuns(parseCron('0 0 13 * 5', 'unix'), new Date(Date.UTC(2024, 0, 1)), 3, 'utc').map((d) => d.toISOString().slice(0, 10))).toEqual(['2024-01-05', '2024-01-12', '2024-01-13']) // dom OR dow
    expect(nextRuns(parseCron('*/30 * * * * *', 'spring'), new Date(Date.UTC(2024, 0, 1)), 2, 'utc').map((d) => d.getUTCSeconds())).toEqual([30, 0]); expect(nextRuns(parseCron('0 0 0 30 2 ?', 'quartz'), new Date(Date.UTC(2024, 0, 1)), 1, 'utc')).toEqual([])
  })
  it('decodes Snowflake IDs', () => {
    const d = SNOWFLAKE_PRESETS.discord; const r = decodeSnowflake(175928847299117063n, d.epoch, d.dc, d.worker, d.seq)
    expect(new Date(r.timestampMs).toISOString()).toBe('2016-04-30T11:18:25.796Z'); expect(r).toMatchObject({ datacenter: 1n, worker: 0n, sequence: 7n })
    const t = SNOWFLAKE_PRESETS.twitter; const id = composeSnowflake(1700000000000, t.epoch, t.dc, t.worker, t.seq, 3n, 9n, 100n); expect(decodeSnowflake(id, t.epoch, t.dc, t.worker, t.seq)).toMatchObject({ timestampMs: 1700000000000, datacenter: 3n, worker: 9n, sequence: 100n })
  })
  it('converts CSS units', () => {
    const ctx = { root: 16, parent: 20, vw: 1000, vh: 800, percentOf: 400 }
    expect(cssToPx(1.5, 'rem', ctx)).toBe(24); expect(cssToPx(2, 'em', ctx)).toBe(40); expect(cssToPx(12, 'pt', ctx)).toBe(16); expect(cssToPx(1, 'in', ctx)).toBe(96); expect(cssToPx(10, 'vw', ctx)).toBe(100); expect(cssToPx(50, '%', ctx)).toBe(200); expect(pxToCss(24, 'rem', ctx)).toBe(1.5); expect(pxToCss(96, 'cm', ctx)).toBeCloseTo(2.54, 5); expect(pxToCss(16, 'pc', ctx)).toBe(1)
  })
})

describe('Color', () => {
  it('parses and converts formats', () => {
    expect(parseColor('#0f766e')).toEqual({ r: 15, g: 118, b: 110, a: 1 }); expect(parseColor('#abc')).toEqual({ r: 170, g: 187, b: 204, a: 1 }); expect(parseColor('rgb(10, 20, 30)')).toEqual({ r: 10, g: 20, b: 30, a: 1 }); expect(parseColor('rgba(10 20 30 / 50%)').a).toBe(0.5); expect(parseColor('hsl(120, 100%, 50%)')).toMatchObject({ r: 0, g: 255, b: 0 }); expect(parseColor('rebeccapurple')).toMatchObject({ r: 102, g: 51, b: 153 }); expect(parseColor('#ff000080').a).toBeCloseTo(0.5, 1)
    const c = parseColor('#336699'); expect(toHex(c)).toBe('#336699'); expect(toRgbString(c)).toBe('rgb(51, 102, 153)'); expect(toHslString(c)).toBe('hsl(210, 50%, 40%)'); expect(hslToRgb(rgbToHsl(c))).toEqual(c)
    for (const bad of ['', '#12', 'rgb(300,0,0)', 'hsl(10, 200%, 50%)', 'notacolor']) expect(() => parseColor(bad), bad).toThrow()
  })
  it('computes WCAG contrast', () => {
    const w = parseColor('#fff'), b = parseColor('#000'); expect(contrastRatio(b, w)).toBeCloseTo(21, 5); expect(contrastRatio(w, w)).toBe(1); expect(luminance(w)).toBe(1)
    expect(contrastRatio(parseColor('#767676'), w)).toBeGreaterThanOrEqual(4.5); expect(contrastRatio(parseColor('#777777'), w)).toBeLessThan(4.5)
    expect(wcag(4.5)).toMatchObject({ aaNormal: true, aaaNormal: false, aaLarge: true, aaaLarge: true }); expect(wcag(2.9).ui).toBe(false)
    const fix = suggestForeground(parseColor('#999999'), w)!; expect(contrastRatio(fix, w)).toBeGreaterThanOrEqual(4.5)
  })
  it('generates palettes', () => {
    const base = parseColor('#ff0000'); expect(toHex(palette(base, 'complementary')[1])).toBe('#00FFFF'); const tri = palette(base, 'triadic', 3).map((c) => Math.round(rgbToHsl(c).h)); expect(tri).toEqual([0, 120, 240]); expect(palette(base, 'monochromatic', 5)).toHaveLength(5); expect(palette(base, 'analogous', 5)).toHaveLength(5)
  })
})

describe('Regex explainer', () => { it('explains tokens', () => { const e = explainRegex('^(?<y>\\d{4})-[a-z]+\\.*$'); expect(e.map((x) => x.token)).toEqual(['^', '(?<y>', '\\d', '{4}', ')', '-', '[a-z]', '+', '\\.', '*', '$']); expect(e[1].text).toMatch(/named capture group “y”/) }) })
