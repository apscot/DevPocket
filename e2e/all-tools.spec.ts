import { expect, test } from '@playwright/test'
import fs from 'node:fs'

const ids = [...fs.readFileSync('src/registry.ts', 'utf8').matchAll(/^  \['([a-z0-9-]+)'/gm)].map((m) => m[1])

test('registry lists 101 tools', () => { expect(ids).toHaveLength(101) })

// Every catalogued tool must be reachable, render its title and not crash or log errors.
test('every one of the 101 tools renders without errors', async ({ page }) => {
  test.setTimeout(240000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(`console: ${m.text()}`) })
  for (const id of ids) {
    await page.goto(`./#/tools/${id}`)
    await expect(page.getByTestId('tool-title'), id).toBeVisible()
    await expect(page.getByText('Loading tool…'), id).toHaveCount(0, { timeout: 10000 })
    await expect(page.getByText('This tool crashed'), id).toHaveCount(0)
    expect(errors, id).toEqual([])
  }
})
