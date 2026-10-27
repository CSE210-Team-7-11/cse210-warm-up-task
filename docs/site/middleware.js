import { defineMiddleware } from 'astro/middleware'

/**
 * Keep repository Markdown links working in generated HTML, including anchors.
 * @param {string} match Complete href attribute.
 * @param {string} path Link path without the Markdown extension.
 * @param {string} [suffix=''] Query or fragment, if present.
 * @returns {string} Original external link or local HTML link.
 */
function htmlLink(match, path, suffix = '') {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(path)) return match
  return `href="${path}.html${suffix}"`
}

export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next()
  if (!response.headers.get('content-type')?.includes('text/html')) return response
  const html = (await response.text()).replace(/href="([^"<>]+)\.md([?#][^"<>]*)?"/g, htmlLink)
  const headers = new Headers(response.headers)
  headers.delete('content-length')
  return new Response(html, { status: response.status, headers })
})
