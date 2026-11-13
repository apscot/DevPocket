import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import vm from 'node:vm'

// Executes the inline script of public/404.html against a fake location to verify GitHub Pages deep-link recovery.
const script = /<script>([\s\S]*?)<\/script>/.exec(fs.readFileSync('public/404.html', 'utf8'))![1]
const redirect = (pathname: string, search = '') => {
  let target = ''
  const location = { pathname, search, origin: 'https://user.github.io', replace: (u: string) => (target = u) }
  vm.runInNewContext(script, { location })
  return target
}

describe('GitHub Pages 404 fallback', () => {
  it('converts project-page deep links to hash routes', () => {
    expect(redirect('/DevPocket/tools/json-formatter')).toBe('https://user.github.io/DevPocket/#/tools/json-formatter')
    expect(redirect('/DevPocket/category/devops')).toBe('https://user.github.io/DevPocket/#/category/devops')
    expect(redirect('/DevPocket/favorites')).toBe('https://user.github.io/DevPocket/#/favorites')
  })
  it('supports user/organisation pages served from the domain root', () => {
    expect(redirect('/tools/uuid-generator')).toBe('https://user.github.io/#/tools/uuid-generator')
  })
  it('sends unknown paths to the app home', () => { expect(redirect('/DevPocket/nope')).toBe('https://user.github.io/DevPocket/') })
})
