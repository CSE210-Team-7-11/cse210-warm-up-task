import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom has no canvas implementation. The graph library only needs a 2D context
// whose calls succeed and whose measureText returns a width, so every method is
// a no-op and every property assignment is accepted.
function fakeContext2d() {
  const state = {}
  return new Proxy(state, {
    get(target, key) {
      if (key in target) return target[key]
      if (key === 'measureText') {
        return (text) => ({ width: String(text).length * 7, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 })
      }
      if (key === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })
      if (key === 'getLineDash') return () => []
      return () => {}
    },
    set(target, key, value) {
      target[key] = value
      return true
    },
  })
}

HTMLCanvasElement.prototype.getContext = function getContext() {
  this.__ctx ??= fakeContext2d()
  return this.__ctx
}

globalThis.ResizeObserver ??= class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

afterEach(cleanup)
