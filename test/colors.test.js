import assert from 'node:assert/strict'
import test from 'node:test'
import { withSeriesColors } from '../src/graph/colors.js'

const blank = (count) => Array.from({ length: count }, () => ({}))

test('gives every series without a color its own color', () => {
  const colors = withSeriesColors(blank(12)).map((series) => series.color)

  assert.equal(new Set(colors).size, 12)
  for (const color of colors) {
    assert.match(color, /^#[0-9a-f]{6}$/)
  }
})

test('keeps colors the caller set', () => {
  const series = withSeriesColors([{ color: '#2a78d6' }, {}, { color: 'tomato' }])

  assert.equal(series[0].color, '#2a78d6')
  assert.equal(series[2].color, 'tomato')
  assert.notEqual(series[1].color, '#2a78d6')
})

test('leaves series alone when every one has a color', () => {
  const series = [{ color: '#2a78d6' }, { color: '#eb6834' }]

  assert.equal(withSeriesColors(series), series)
})

test('adding a series does not repaint the earlier ones', () => {
  const five = withSeriesColors(blank(5)).map((series) => series.color)
  const twelve = withSeriesColors(blank(12)).map((series) => series.color)

  assert.deepEqual(twelve.slice(0, 5), five)
})
