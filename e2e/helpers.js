import AxeBuilder from '@axe-core/playwright'
import { expect } from '@playwright/test'

export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa']

// Known issue: these design tokens in src/index.css are below 4.5:1 on the
// editor's white and #fafbf7 surfaces (WCAG 1.4.3). Text using any other color
// is still checked. Delete an entry once its token is darkened.
export const KNOWN_LOW_CONTRAST_COLORS = new Set([
  '#8a968c', // --text-muted, ~3.0:1
  '#4e8d6d', // --green-500 step numbers, 3.9:1
  '#b9736b', // --danger-muted errors and warnings, 3.7:1
])

const isKnownIssue = (rule, node) =>
  rule === 'color-contrast' && KNOWN_LOW_CONTRAST_COLORS.has(node.any[0]?.data?.fgColor)

export async function expectNoAxeViolations(page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
  const violations = results.violations
    .map((v) => ({ ...v, nodes: v.nodes.filter((node) => !isKnownIssue(v.id, node)) }))
    .filter((v) => v.nodes.length)
  const summary = violations.map(({ id, help, nodes }) =>
    `${id}: ${help}\n${nodes.map((n) => `  ${n.target.join(' ')}\n    ${n.any[0]?.message ?? n.failureSummary}`).join('\n')}`)
  expect(violations.map((v) => v.id), summary.join('\n\n')).toEqual([])
}

/** Description Chromium exposes to assistive technology for the node with this accessible name. */
export async function chromeAccessibleDescription(page, name) {
  const cdp = await page.context().newCDPSession(page)
  const { nodes } = await cdp.send('Accessibility.getFullAXTree')
  await cdp.detach()
  return nodes.find((node) => node.name?.value === name)?.description?.value ?? ''
}

const STYLE_PROPS = ['outlineStyle', 'outlineWidth', 'outlineColor', 'boxShadow', 'borderColor', 'backgroundColor']

/**
 * Press Tab until focus leaves the page. For every stop, record its accessible
 * description and whether focusing it visibly changed the element or one of its
 * two nearest ancestors (some controls draw the ring on a wrapper).
 * Throws if focus never leaves: a keyboard trap.
 */
export async function walkTabOrder(page, { maxStops = 80, key = 'Tab' } = {}) {
  await page.evaluate((props) => {
    const snapshot = (el) => [el, el.parentElement, el.parentElement?.parentElement]
      .filter(Boolean).map((node) => { const s = getComputedStyle(node); return props.map((p) => s[p]).join('|') })
    window.__unfocused = new Map([...document.querySelectorAll('*')].map((el) => [el, snapshot(el)]))
    window.__snapshot = snapshot
    document.activeElement?.blur()
  }, STYLE_PROPS)

  const stops = []
  for (let i = 0; i < maxStops; i++) {
    await page.keyboard.press(key)
    const stop = await page.evaluate(() => {
      const el = document.activeElement
      if (!el || el === document.body) return null
      // An inline link around a floated image has a 0-width box of its own,
      // but the browser draws the focus ring around the image.
      const rendered = [el, ...el.querySelectorAll('*')].some((node) => {
        const r = node.getBoundingClientRect()
        return r.width > 0 && r.height > 0
      })
      const before = window.__unfocused.get(el) ?? []
      const after = window.__snapshot(el)
      return {
        name: (el.getAttribute('aria-label') || el.labels?.[0]?.innerText || el.innerText || el.querySelector('img')?.alt || el.tagName)
          .replace(/\s+/g, ' ').trim(),
        tag: el.tagName.toLowerCase(),
        visibleFocus: after.some((style, i) => style !== before[i]),
        onScreen: rendered,
      }
    })
    if (!stop) return stops
    stops.push(stop)
  }
  throw new Error(`Focus never left the page after ${maxStops} Tab presses: keyboard trap`)
}

export function expectEveryStopVisible(stops) {
  expect(stops.filter((s) => !s.visibleFocus), 'stops without a visible focus indicator').toEqual([])
  expect(stops.filter((s) => !s.onScreen), 'stops with no rendered size').toEqual([])
}
