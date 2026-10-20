import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { initialState, parseDelimited, seriesFromColumns } from '../src/state.js'
import { buildChartData } from '../src/components/charts/chartUtils.js'

// Each file in test/fixtures is imported like a dropped file and compared with
// <name>.expected.json. UPDATE_FIXTURES=1 writes the expected files instead;
// check what it writes before committing it.
const FIXTURES = new URL('./fixtures/', import.meta.url)
const update = process.env.UPDATE_FIXTURES === '1'

// JSON has no Infinity or NaN, so they are stored as strings
const encode = (_, value) => typeof value === 'number' && !Number.isFinite(value) ? String(value) : value

function importFixture(text) {
  const parsed = parseDelimited(text, { emptyCells: 'mark' })
  if (!parsed) return null
  const { columns } = buildChartData({ ...initialState, ...parsed, series: seriesFromColumns(parsed.columns) })
  return {
    delimiter: parsed.delimiter,
    numberFormat: parsed.numberFormat,
    columns: parsed.columns.map((column) => column.name),
    issues: parsed.issues,
    x: Array.from(columns.x),
    ys: columns.ys.map((ys) => Array.from(ys)),
  }
}

const files = readdirSync(FIXTURES).filter((name) => /\.(csv|tsv|txt)$/.test(name)).sort()

const expectedName = (name) => name.replace(/\.\w+$/, '.expected.json')

test('there are import fixtures, each with its own expected file', () => {
  assert.ok(files.length > 0)
  assert.equal(new Set(files.map(expectedName)).size, files.length)
})

for (const name of files) {
  test(`fixture ${name}`, () => {
    const expectedFile = new URL(expectedName(name), FIXTURES)
    const actual = JSON.parse(JSON.stringify(importFixture(readFileSync(new URL(name, FIXTURES), 'utf8')), encode))
    if (update) writeFileSync(expectedFile, JSON.stringify(actual, encode, 2) + '\n')
    assert.ok(existsSync(expectedFile), `${name} has no expected file; run with UPDATE_FIXTURES=1 to write one`)
    assert.deepEqual(actual, JSON.parse(readFileSync(expectedFile, 'utf8')))
  })
}
