import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'vite'
import { initialState, parseDelimited, seriesFromColumns } from '../src/state.js'
import { prepareChart } from '../src/components/charts/chartAdapter.js'
import { bounds, computeLayout } from '../src/graph/scale.js'

function createCanvas() {
	const calls = []
	const listeners = {}
	const ctx = new Proxy(
		{},
		{
			get(target, name) {
				if (name in target) {
					return target[name]
				}
				if (name === 'measureText') {
					return (text) => ({ width: text.length * 4 })
				}
				if (name === 'getTransform') {
					return () => ({ a: 1 })
				}
				return (...args) => calls.push([name, ...args])
			},
		},
	)
	return {
		calls,
		listeners,
		getContext: () => ctx,
		setAttribute() {},
		addEventListener: (name, listener) => {
			listeners[name] = listener
		},
		removeEventListener: (name) => {
			delete listeners[name]
		},
		getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 480 }),
		remove() {},
	}
}

test('the standalone chart draws None as circles on scatter and retains None on line', async (t) => {
	const server = await createServer({
		server: { middlewareMode: true, hmr: false, ws: false },
		appType: 'custom',
	})
	t.after(() => server.close())
	const { createChart } = await server.ssrLoadModule('/src/graph/Graph.js')
	for (const [name, value] of Object.entries({
		document: { createElement: createCanvas },
		window: { devicePixelRatio: 1 },
		ResizeObserver: class {
			observe() {}
			disconnect() {}
		},
	})) {
		const descriptor = Object.getOwnPropertyDescriptor(globalThis, name)
		Object.defineProperty(globalThis, name, { configurable: true, value })
		t.after(() =>
			descriptor
				? Object.defineProperty(globalThis, name, descriptor)
				: delete globalThis[name],
		)
	}
	const parsed = parseDelimited('X,A,B\n1,2,6\n2,3,5\n3,4,4')
	const series = seriesFromColumns(parsed.columns).map((s, i) =>
		i === 0 ? { ...s, marker: 'none' } : s,
	)
	for (const precision of ['float32', 'float64']) {
		const { graphProps } = prepareChart({ ...initialState, ...parsed, series }, { precision })
		const options = {
			...graphProps,
			series: Object.freeze(graphProps.series.map((s) => Object.freeze(s))),
			showPoints: false,
		}
		const container = {
			clientWidth: 800,
			append(element) {
				this.canvas = element
				element.isConnected = true
			},
		}
		const chart = createChart(container)
		try {
			for (const type of [undefined, 'line', 'scatter', 'line']) {
				if (container.canvas) {
					container.canvas.calls.length = 0
				}
				chart.update({ ...options, type })
				const { canvas } = container
				assert.equal(
					canvas.calls.filter(([name]) => name === 'arc').length,
					type === 'line' ? 0 : 4,
				)
				assert.equal(options.series[0].marker, 'none')
				if (type !== 'line') {
					const layout = computeLayout(bounds(graphProps.columns))
					canvas.calls.length = 0
					canvas.listeners.pointermove({
						currentTarget: canvas,
						clientX: layout.toX(2) * 1.6,
						clientY: layout.toY(3) * 1.6,
					})
					assert.ok(
						canvas.calls.some(([name, text]) => name === 'fillText' && text === 'A: '),
					)
					assert.deepEqual(
						canvas.calls.filter(([name]) => name === 'arc').map((call) => call[3]),
						[5, 3],
					)
					assert.equal(canvas.calls.filter(([name]) => name === 'drawImage').length, 1)
				}
			}
		} finally {
			chart.destroy()
		}
	}
})
