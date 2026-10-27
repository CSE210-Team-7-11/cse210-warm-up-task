import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import test from 'node:test'

/** Canvas stand-in recording drawing, attributes, listeners, and removal. */
function canvas() {
  const calls = []
  const attributes = new Map()
  const listeners = new Map()
  const ctx = new Proxy({}, {
    get(target, name) {
      if (name in target) return target[name]
      if (name === 'measureText') return text => ({ width: text.length * 4 })
      if (name === 'getTransform') return () => ({ a: 1 })
      return (...args) => calls.push([name, ...args])
    },
  })
  return {
    calls, attributes, listeners,
    getContext: () => ctx,
    setAttribute: (name, value) => attributes.set(name, value),
    addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: name => listeners.delete(name),
    remove() { this.isConnected = false; this.removed = true },
  }
}

test('a chart draws initial options, updates in place, resizes, and releases its resources', async (t) => {
  // Keep the JavaScript source visible to Node's coverage reporter.
  // CSS is handled by the website build; this test uses a canvas stand-in.
  const graphCssUrl = new URL('../src/graph/Graph.css', import.meta.url).href
  const hooks = registerHooks({
    load(url, context, nextLoad) {
      if (url === graphCssUrl) return { format: 'module', source: '', shortCircuit: true }
      return nextLoad(url, context)
    },
  })
  t.after(() => hooks.deregister())
  const { createChart } = await import('../src/graph/Graph.js')

  const observers = []
  for (const [name, value] of Object.entries({
    document: { createElement: canvas },
    window: { devicePixelRatio: 2 },
    ResizeObserver: class {
      constructor(callback) { this.callback = callback; observers.push(this) }
      observe(target) { this.target = target }
      disconnect() { this.disconnected = true }
    },
  })) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name)
    Object.defineProperty(globalThis, name, { configurable: true, value })
    t.after(() => descriptor ? Object.defineProperty(globalThis, name, descriptor) : delete globalThis[name])
  }

  const children = []
  const container = {
    clientWidth: 500,
    append(element) { children.push(element); element.isConnected = true },
  }
  const options = {
    type: 'line',
    labels: { title: 'Sales', subtitle: '', x_axis_label: 'Day', y_axis_label: 'Amount' },
    series: [{ name: 'Sales', color: '#2a78d6' }],
    columns: { length: 2, x: Float64Array.of(1, 2), ys: [Float64Array.of(24, 31)] },
  }
  const chart = createChart(container, options)
  const drawn = children[0]
  try {
    assert.equal(children.length, 1)
    assert.equal(drawn.attributes.get('aria-label'), 'line plot of 2 points')
    assert.ok(drawn.calls.some(([name, text]) => name === 'fillText' && text === 'Sales'))
    assert.equal(drawn.width, 1000)
    assert.equal(observers[0].target, container)
    assert.deepEqual([...drawn.listeners.keys()].sort(), ['pointerleave', 'pointermove'])

    drawn.calls.length = 0
    const result = chart.update({ ...options, type: 'scatter', labels: { ...options.labels, title: 'Updated sales' } })
    assert.deepEqual(result, { warnings: [] })
    assert.equal(children.length, 1)
    assert.equal(drawn.attributes.get('aria-label'), 'scatter plot of 2 points')
    assert.ok(drawn.calls.some(([name, text]) => name === 'fillText' && text === 'Updated sales'))

    container.clientWidth = 250
    drawn.calls.length = 0
    observers[0].callback()
    assert.equal(drawn.width, 500)
    assert.ok(drawn.calls.some(([name, text]) => name === 'fillText' && text === 'Updated sales'))
  } finally {
    chart.destroy()
  }
  assert.equal(drawn.removed, true)
  assert.equal(drawn.listeners.size, 0)
  assert.equal(observers[0].disconnected, true)
})
