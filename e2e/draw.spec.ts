import { expect, test, type Page } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const sceneCount = (page: Page) => page.locator('[data-testid=scene] > *').count()
async function box(page: Page) { const b = await page.getByTestId('draw-canvas').boundingBox(); if (!b) throw new Error('no canvas'); return b }
async function download(page: Page, open: () => Promise<void>, click: () => Promise<void>) {
  await open(); const [dl] = await Promise.all([page.waitForEvent('download'), click()]); return { name: dl.suggestedFilename(), buf: await readFile(await dl.path()) }
}

test.describe('Diagram Editor', () => {
  test.beforeEach(async ({ page }) => { await page.goto('./#/tools/diagram-editor'); await page.evaluate(() => localStorage.clear()); await page.reload(); await expect(page.getByTestId('draw-canvas')).toBeVisible() })

  test('adds shapes, edits text, connects with a drag, undoes and redoes', async ({ page }) => {
    await expect(page.getByTestId('empty-hint')).toBeVisible()
    await page.getByRole('button', { name: 'Add Rectangle' }).click()
    const cb = await box(page)
    await page.getByRole('button', { name: 'Add Ellipse' }).dragTo(page.getByTestId('draw-canvas'), { targetPosition: { x: cb.width - 230, y: 190 } })
    expect(await sceneCount(page)).toBe(2)
    const r = (await page.locator('[data-testid=scene] g[data-el]').first().boundingBox())!
    await page.mouse.dblclick(r.x + r.width / 2, r.y + r.height / 2)
    await page.getByTestId('text-editor').fill('API Gateway'); await page.keyboard.press('Escape')
    await expect(page.getByTestId('scene')).toContainText('API Gateway')
    // hover -> connection arrow -> drag onto the ellipse
    await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2)
    const arrow = (await page.locator('[data-conn=r]').boundingBox())!; const e = (await page.locator('[data-testid=scene] g[data-el]').nth(1).boundingBox())!
    await page.mouse.move(arrow.x + arrow.width / 2, arrow.y + arrow.height / 2); await page.mouse.down(); await page.mouse.move(e.x + e.width / 2, e.y + e.height / 2, { steps: 10 }); await page.mouse.up()
    expect(await sceneCount(page)).toBe(3)
    await page.getByRole('button', { name: /^Undo/ }).click(); expect(await sceneCount(page)).toBe(2)
    await page.getByRole('button', { name: /^Redo/ }).click(); expect(await sceneCount(page)).toBe(3)
    // moving a shape keeps the connector attached (the edge path follows)
    const before = await page.locator('[data-testid=scene] path').last().getAttribute('d')
    await page.mouse.move(e.x + e.width / 2, e.y + e.height / 2); await page.mouse.down(); await page.mouse.move(e.x + e.width / 2, e.y + e.height / 2 + 90, { steps: 8 }); await page.mouse.up()
    expect(await page.locator('[data-testid=scene] path').last().getAttribute('d')).not.toBe(before)
  })

  test('typing on a selected shape starts editing; delete removes it; autosave survives reload', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Diamond' }).click(); await page.getByTestId('draw-canvas').click({ position: { x: 5, y: 5 } })
    const r = (await page.locator('[data-testid=scene] g[data-el]').first().boundingBox())!
    await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2); await page.keyboard.type('Ok?'); await page.keyboard.press('Escape')
    await expect(page.getByTestId('scene')).toContainText('Ok?')
    await expect(page.getByText('Saved in this browser')).toBeVisible({ timeout: 5000 })
    await page.reload(); await expect(page.getByTestId('scene')).toContainText('Ok?')
    await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2); await page.keyboard.press('Delete'); expect(await sceneCount(page)).toBe(0)
  })

  test('templates, Mermaid import and auto-layout build editable diagrams', async ({ page }) => {
    await page.getByTestId('templates-menu').click(); await page.getByRole('menuitem', { name: /Microservices/ }).click()
    expect(await sceneCount(page)).toBe(8 + 8)
    await page.getByTestId('file-menu').click(); page.once('dialog', (d) => void d.accept()); await page.getByRole('menuitem', { name: 'New' }).click(); expect(await sceneCount(page)).toBe(0)
    await page.getByTestId('templates-menu').click(); await page.getByRole('menuitem', { name: /Insert from Mermaid/ }).click()
    await expect(page.getByText('6 nodes, 7 connections')).toBeVisible(); await page.getByTestId('mermaid-insert').click()
    expect(await sceneCount(page)).toBe(13); await expect(page.getByTestId("scene")).toContainText("Show dashboard")
    await page.getByLabel('Mermaid flowchart').count()
    await page.getByTestId('layout-menu').click(); await page.getByRole('menuitem', { name: /left → right/ }).click(); expect(await sceneCount(page)).toBe(13)
  })

  test('rejects non-flowchart Mermaid with a clear message', async ({ page }) => {
    await page.getByTestId('templates-menu').click(); await page.getByRole('menuitem', { name: /Insert from Mermaid/ }).click()
    await page.getByLabel('Mermaid flowchart').fill('sequenceDiagram\n A->>B: hi')
    await expect(page.getByRole('alert')).toContainText('flowchart'); await expect(page.getByTestId('mermaid-insert')).toBeDisabled()
  })

  test('exports PNG, SVG, JSON and .drawio, and re-opens what it saved', async ({ page }) => {
    await page.getByTestId('templates-menu').click(); await page.getByRole('menuitem', { name: /Flowchart/ }).click()
    const menu = (id: string) => async () => { await page.getByTestId(id).click() }
    const png = await download(page, menu('export-menu'), () => page.getByRole('menuitem', { name: /PNG \(2×\)/ }).click())
    expect(png.name).toBe('diagram.png'); expect(png.buf.subarray(1, 4).toString()).toBe('PNG'); expect(png.buf.length).toBeGreaterThan(5000)
    const svg = await download(page, menu('export-menu'), () => page.getByRole('menuitem', { name: /SVG \(vector\)/ }).click())
    expect(svg.buf.toString()).toContain('Receive request'); expect(svg.buf.toString()).toContain('viewBox')
    const dio = await download(page, menu('file-menu'), () => page.getByRole('menuitem', { name: /draw\.io \(\.drawio\)/ }).click())
    expect(dio.name).toBe('diagram.drawio'); expect(dio.buf.toString()).toContain('<mxfile'); expect(dio.buf.toString()).toContain('rhombus')
    const json = await download(page, menu('file-menu'), () => page.getByRole('menuitem', { name: /Save as JSON/ }).click())
    // clear, then re-open the saved JSON and a .drawio file
    await page.getByTestId('file-menu').click(); page.once('dialog', (d) => void d.accept()); await page.getByRole('menuitem', { name: 'New' }).click(); expect(await sceneCount(page)).toBe(0)
    const jp = join(tmpdir(), 'dp-test.dpdraw.json'); await writeFile(jp, json.buf); await page.getByTestId('open-input').setInputFiles(jp)
    await expect(page.getByTestId('scene')).toContainText('Return error'); const n = await sceneCount(page)
    const dp = join(tmpdir(), 'dp-test.drawio'); await writeFile(dp, dio.buf); await page.getByTestId('open-input').setInputFiles(dp)
    await expect(page.getByTestId('draw-notice')).toContainText('Imported'); expect(await sceneCount(page)).toBe(n)
    await writeFile(jp, '{"nope":1}'); await page.getByTestId('open-input').setInputFiles(jp); await expect(page.getByTestId('draw-notice')).toContainText('Not a DevPocket drawing')
  })

  test('format panel changes selected shapes; marquee, align and group work', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Rectangle' }).click(); await page.getByRole('button', { name: 'Add Circle' }).click()
    await page.getByTestId('draw-canvas').click({ position: { x: 4, y: 4 } })
    await page.keyboard.press('Control+a'); await expect(page.getByTestId('props-panel')).toContainText('2 selected')
    await page.getByRole('button', { name: 'Fill #dbeafe' }).click()
    expect(await page.locator('[data-testid=scene] rect[fill="#dbeafe"], [data-testid=scene] ellipse[fill="#dbeafe"]').count()).toBe(2)
    await page.getByRole('button', { name: 'Align objects left' }).click(); await page.getByRole('button', { name: 'Group', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Ungroup' })).toBeEnabled()
    await page.getByRole('button', { name: 'Hand-drawn' }).click(); await expect(page.locator('[data-testid=scene] path').first()).toBeVisible()
  })
})

test.describe('Whiteboard', () => {
  test.beforeEach(async ({ page }) => { await page.goto('./#/tools/whiteboard'); await page.evaluate(() => localStorage.clear()); await page.reload(); await expect(page.getByTestId('draw-canvas')).toBeVisible() })
  const stroke = async (page: Page, pts: [number, number][]) => { const c = await box(page); await page.mouse.move(c.x + pts[0][0], c.y + pts[0][1]); await page.mouse.down(); for (const [x, y] of pts) await page.mouse.move(c.x + x, c.y + y, { steps: 3 }); await page.mouse.up() }

  test('draws with the pen, erases, adds sticky notes and shapes via shortcuts', async ({ page }) => {
    await page.keyboard.press('p'); await stroke(page, Array.from({ length: 25 }, (_, i) => [500 + i * 8, 200 + Math.sin(i / 3) * 30] as [number, number]))
    expect(await sceneCount(page)).toBe(1)
    await page.keyboard.press('e'); await stroke(page, [[560, 150], [560, 260]]); expect(await sceneCount(page)).toBe(0)
    await page.getByRole('button', { name: /^Undo/ }).click(); expect(await sceneCount(page)).toBe(1)
    await page.keyboard.press('n'); const c = await box(page); await page.mouse.click(c.x + 700, c.y + 380); await page.getByTestId('text-editor').fill('Ship it'); await page.keyboard.press('Escape')
    await expect(page.getByTestId('scene')).toContainText('Ship it')
    await page.keyboard.press('r'); await page.mouse.move(c.x + 500, c.y + 330); await page.mouse.down(); await page.mouse.move(c.x + 640, c.y + 420, { steps: 6 }); await page.mouse.up()
    await page.keyboard.press('a'); await page.mouse.move(c.x + 640, c.y + 375); await page.mouse.down(); await page.mouse.move(c.x + 690, c.y + 380, { steps: 5 }); await page.mouse.up()
    expect(await sceneCount(page)).toBe(4)
  })

  test('zooms, pans, switches background and inverts the default ink on dark', async ({ page }) => {
    await page.keyboard.press('p'); await stroke(page, [[500, 200], [560, 240], [620, 200]])
    const ink = page.locator('[data-testid=scene] path').first()
    expect(await ink.getAttribute('fill')).toBe('#1f2937')
    await page.getByRole('button', { name: 'Zoom in' }).click(); await expect(page.getByTestId('zoom-level')).toHaveText('125%')
    await page.getByRole('button', { name: 'Fit to screen' }).click()
    await page.keyboard.press('Escape'); await page.getByTestId('draw-canvas').click({ position: { x: 900, y: 120 } }); await page.getByRole('button', { name: 'Background #1e1e1e' }).click()
    expect(await ink.getAttribute('fill')).toBe('#f1f5f9')
    await expect(page.getByTestId('whiteboard')).toBeVisible()
  })

  test('opens help and exports a transparent PNG', async ({ page }) => {
    await page.keyboard.press('?'); await expect(page.getByRole('dialog', { name: /Keyboard shortcuts/ })).toBeVisible(); await page.keyboard.press('Escape')
    await page.keyboard.press('p'); await stroke(page, [[500, 200], [600, 260], [700, 200]])
    const png = await download(page, async () => { await page.getByTestId('export-menu').click() }, () => page.getByRole('menuitem', { name: /transparent/ }).click())
    expect(png.buf.subarray(1, 4).toString()).toBe('PNG')
  })
})
