import axe from 'axe-core'
import { expect } from 'vitest'

// WCAG 2.0, 2.1 and 2.2 at levels A and AA: the usual legal and product baseline.
export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa']

// jsdom has no layout or computed colors, so contrast is checked in the
// Playwright suite (e2e/) against a real browser instead.
const JSDOM_UNSUPPORTED = { 'color-contrast': { enabled: false } }

function describe(violations) {
  return violations.map(({ id, help, nodes }) =>
    `${id}: ${help}\n${nodes.map(({ target, failureSummary }) => `  ${target.join(' ')}\n    ${failureSummary.replace(/\n/g, '\n    ')}`).join('\n')}`,
  ).join('\n\n')
}

export async function expectNoAxeViolations(context = document.body) {
  const { violations } = await axe.run(context, {
    runOnly: { type: 'tag', values: WCAG_TAGS },
    rules: JSDOM_UNSUPPORTED,
  })
  expect(violations, describe(violations)).toEqual([])
}
