import { describe, expect, it } from 'vitest'
import { compareFlat, compareToCsv, countStatus, isSensitiveKey, maskValue, parseConfig, parseProperties, parseYamlFlat, relaxKey } from '@/lib/config'
import { envToMap, formatEnv, parseEnv } from '@/lib/env'
import { formatTrace, parseTrace } from '@/lib/javatrace'
import { minifySql, replaceSqlVariables } from '@/lib/sql'
import { javaFormat, parseArg, JavaFormatError } from '@/lib/javafmt'
import { formatYaml, validateYaml } from '@/lib/yamlutil'
import { SAMPLE_STACK, SAMPLE_YAML, SAMPLE_YAML_B } from '@/lib/samples'
import { format } from 'sql-formatter'

describe('Spring properties / YAML comparison', () => {
  it('parses .properties with comments, separators, continuation and escapes', () => {
    const m = parseProperties('# c\n! c2\na.b=1\nc.d : two words\ne.f value\nlong=one\\\n  two\nuni=caf\\u00e9\nempty=\n')
    expect(Object.fromEntries(m)).toEqual({ 'a.b': '1', 'c.d': 'two words', 'e.f': 'value', long: 'onetwo', uni: 'café', empty: '' })
  })
  it('flattens YAML including arrays and nested maps', () => {
    const m = parseYamlFlat('a:\n  b: 1\n  list:\n    - x\n    - y: 2\nempty: {}\nnul: ~\n')
    expect(Object.fromEntries(m)).toEqual({ 'a.b': '1', 'a.list[0]': 'x', 'a.list[1].y': '2', empty: '{}', nul: '' })
  })
  it('normalizes yaml and properties into the same representation', () => {
    const y = parseConfig('server:\n  port: 8080\n', 'auto'); const p = parseConfig('server.port=8080\n', 'auto')
    expect([...y]).toEqual([...p])
  })
  it('compares with accurate counts, ignoring key order', () => {
    const a = parseConfig(SAMPLE_YAML, 'yaml'), b = parseConfig(SAMPLE_YAML_B, 'yaml')
    const rows = compareFlat(a, b); const c = countStatus(rows)
    expect(c.modified).toBe(4) // port, url, password, ddl-auto
    expect(c.removed).toBe(2) // logging.level.root / .com.example
    expect(c.added).toBe(1) // management...
    expect(c.unchanged).toBe(2) // context-path, username
    expect(rows.length).toBe(c.added + c.removed + c.modified + c.unchanged)
    expect(compareFlat(new Map([['b', '1'], ['a', '2']]), new Map([['a', '2'], ['b', '1']])).every((r) => r.status === 'unchanged')).toBe(true)
  })
  it('supports relaxed binding and value options', () => {
    expect(relaxKey('my.db-URL')).toBe(relaxKey('my.dbUrl'))
    const rows = compareFlat(new Map([['my.db-url', 'X']]), new Map([['my.dbUrl', 'x']]), { relaxed: true, ignoreValueCase: true })
    expect(rows).toHaveLength(1); expect(rows[0].status).toBe('unchanged')
  })
  it('detects and masks sensitive keys', () => {
    for (const k of ['spring.datasource.password', 'app.secret', 'jwt.token', 'aws.credentials', 'stripe.api-key', 'x.apiKey', 'client_secret']) expect(isSensitiveKey(k), k).toBe(true)
    for (const k of ['server.port', 'app.name']) expect(isSensitiveKey(k), k).toBe(false)
    expect(maskValue('abc')).not.toContain('abc')
    const csv = compareToCsv([{ key: 'db.password', status: 'modified', left: 'a', right: 'b' }], true)
    expect(csv).not.toMatch(/"a"|"b"/)
  })
})

describe('.env', () => {
  it('parses quotes, comments, export and multiline values', () => {
    const r = parseEnv('# c\nexport A=1\nB="two words" # note\nC=\'x y\'\nD=raw # inline\nE="multi\nline"\n')
    expect(r.errors).toEqual([])
    expect(Object.fromEntries(r.entries.map((e) => [e.key, e.value]))).toEqual({ A: '1', B: 'two words', C: 'x y', D: 'raw', E: 'multi\nline' })
    expect(r.entries[0].exported).toBe(true)
  })
  it('reports errors and warnings', () => {
    const r = parseEnv('BAD LINE\nA=1\nA=2\n1X=3\nQ="open')
    expect(r.errors.map((e) => e.line)).toEqual([1, 5]); expect(r.warnings.some((w) => /Duplicate/.test(w.message))).toBe(true); expect(r.warnings.some((w) => /Unusual/.test(w.message))).toBe(true)
    expect(() => envToMap('BAD')).toThrow(/Line 1/)
  })
  it('formats with sort, align and quoting', () => {
    expect(formatEnv('b=2\na="x y"\n', { sort: true, align: true })).toBe('a="x y"\nb=2\n')
    expect(formatEnv('LONG=1\nS=2', { align: true })).toBe('LONG=1\nS   =2\n')
    expect(formatEnv('A=1', { quote: 'always' })).toBe('A="1"\n')
  })
})

describe('Java stack traces', () => {
  it('parses nested causes, frames and omitted counts', () => {
    const r = parseTrace(SAMPLE_STACK, 'com.example')
    expect(r.items.map((i) => i.kind)).toEqual(['root', 'cause', 'cause', 'cause'])
    expect(r.items[3].type).toBe('org.postgresql.util.PSQLException')
    expect(r.items[3].message).toMatch(/duplicate key value/)
    expect(r.items[1].omitted).toBe(12)
    const appFrame = r.items[1].frames.find((f) => f.cls === 'com.example.service.UserService')!
    expect(appFrame).toMatchObject({ method: 'create', file: 'UserService.java', line: 58, framework: false })
    expect(r.items[0].frames[0].framework).toBe(true)
    expect(formatTrace(r)).toContain('Caused by org.hibernate.exception.ConstraintViolationException')
    expect(formatTrace(r, { hideFramework: true })).toContain('framework frame')
  })
  it('handles module prefixes and native methods', () => {
    const r = parseTrace('java.lang.RuntimeException: x\n\tat java.base/java.lang.Thread.run(Thread.java:833)\n\tat a.B.c(Native Method)')
    expect(r.items[0].frames[0]).toMatchObject({ cls: 'java.lang.Thread', method: 'run', line: 833, module: 'java.base' })
    expect(r.items[0].frames[1].native).toBe(true)
  })
  it('separates multiple traces', () => {
    const r = parseTrace('java.io.IOException: a\n\tat x.Y.z(Y.java:1)\n\njava.lang.Error: b\n\tat x.Y.z(Y.java:2)')
    expect(r.groups).toBe(2)
  })
  it('returns no items for text without exceptions', () => { expect(parseTrace('hello world').items).toHaveLength(0) })
})

describe('SQL', () => {
  it('minifies and preserves string literals', () => {
    expect(minifySql("SELECT  a ,\n b -- c\n FROM t /* x */ WHERE n = 'a  -- b'")).toBe("SELECT a, b FROM t WHERE n = 'a  -- b'")
  })
  it('formats with sql-formatter', () => { expect(format('select a from b', { keywordCase: 'upper' })).toContain('SELECT') })
  it('replaces ? placeholders, escaping quotes and skipping literals', () => {
    const r = replaceSqlVariables("SELECT '?' , x FROM t WHERE a = ? AND b = ? AND c = ?", "O'Brien\n42\nnull")
    expect(r.sql).toBe("SELECT '?' , x FROM t WHERE a = 'O''Brien' AND b = 42 AND c = NULL"); expect(r.used).toBe(3); expect(r.missing).toEqual([])
  })
  it('replaces named, numbered, ${} and #{} placeholders and reports missing ones', () => {
    expect(replaceSqlVariables('a = :id AND b = :name', 'id=5\nname=bob', 'colon').sql).toBe("a = 5 AND b = 'bob'")
    expect(replaceSqlVariables('a = $2 AND b = $1', '["x", 3]').sql).toBe("a = 3 AND b = 'x'")
    expect(replaceSqlVariables('a = ${id}', '{"id": 7}').sql).toBe('a = 7')
    expect(replaceSqlVariables('a = #{id}', 'id=7').sql).toBe('a = 7')
    expect(replaceSqlVariables('a = ? AND b = ?', 'x').missing).toHaveLength(1)
    expect(replaceSqlVariables('a = ::text AND b = :x', 'x=1').sql).toBe('a = ::text AND b = 1')
  })
  it('extracts Hibernate binding logs', () => {
    const logs = 'binding parameter [1] as [VARCHAR] - [alice]\nbinding parameter [2] as [BIGINT] - [10]'
    expect(replaceSqlVariables('where u = ? and n = ?', logs).sql).toBe("where u = 'alice' and n = 10")
  })
})

describe('Java String.format', () => {
  const f = (fmt: string, ...args: string[]) => javaFormat(fmt, args.map(parseArg))
  it('formats common specifiers', () => {
    expect(f('%s is %d years', '"Ada"', '36')).toBe('Ada is 36 years')
    expect(f('%05d|%-5d|%5d|%+d', '42', '42', '42', '42')).toBe('00042|42   |   42|+42')
    expect(f('%,d', '1234567')).toBe('1,234,567'); expect(f('%x %X %o', '255', '255', '8')).toBe('ff FF 10')
    expect(f('%.2f|%8.3f|%e', '3.14159', '2.5', '12345.678')).toBe('3.14|   2.500|1.234568e+04')
    expect(f('%b %c %S %%%n', 'true', "'x'", '"hi"')).toBe('true x HI %\n')
    expect(f('%2$s %1$s', '"a"', '"b"')).toBe('b a')
    expect(f('%(d', '-5')).toBe('(5)'); expect(f('%08.2f', '-3.14159')).toBe('-0003.14')
  })
  it('uses HALF_UP rounding like Java', () => { expect(f('%.2f', '1.005')).toBe('1.01'); expect(f('%.0f', '2.5')).toBe('3'); expect(f('%.1f', '0.05')).toBe('0.1'); expect(f('%.2f', '0.125')).toBe('0.13') })
  it('throws Java-like exceptions', () => {
    expect(() => f('%d', '"x"')).toThrow(/IllegalFormatConversionException: d != java.lang.String/)
    expect(() => f('%s %s', '"a"')).toThrow(/MissingFormatArgumentException/)
    expect(() => f('%q', '1')).toThrow(JavaFormatError)
    expect(() => f('100%', '1')).toThrow(/UnknownFormatConversion/)
  })
})

describe('YAML', () => {
  it('validates with line/column', () => {
    expect(validateYaml(SAMPLE_YAML).ok).toBe(true)
    const r = validateYaml('a: [1, 2\nb: 3'); expect(r.ok).toBe(false); expect(r.line).toBeGreaterThan(0); expect(r.error).toMatch(/line/)
  })
  it('formats and re-indents', () => {
    expect(formatYaml('a:\n    b:   1\n    c: [ 1,2 ]\n', 2)).toBe('a:\n  b: 1\n  c:\n    - 1\n    - 2\n')
    expect(() => formatYaml('a: [')).toThrow()
  })
})
