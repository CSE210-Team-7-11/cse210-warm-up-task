import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

test('frontend contracts accept sample and uploaded data and reject invalid inputs', () => {
	const root = fileURLToPath(new URL('../', import.meta.url))
	const tsc = fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url))
	const result = spawnSync(
		process.execPath,
		[tsc, '--project', 'test/types/jsconfig.json', '--pretty', 'false', '--listFiles'],
		{ cwd: root, encoding: 'utf8', timeout: 30000 },
	)
	assert.equal(result.error, undefined)
	assert.ok([0, 1, 2].includes(result.status), result.stderr)
	assert.equal(result.stderr, '')
	const output = result.stdout.replaceAll('\\', '/')
	assert.match(output, /\/test\/types\/editor-contracts\.js(?:\r?\n|$)/)
	// This regression gate checks the caller contract, including unused
	// @ts-expect-error directives. The repository-wide typecheck remains separate
	// and continues to report the existing implementation diagnostics.
	const diagnostics = output.split('\n').filter((line) => /error TS\d+:/.test(line))
	const contractErrors = diagnostics.filter(
		(line) => !line.startsWith('src/') || line.startsWith('src/editorTypes.js('),
	)
	assert.deepEqual(contractErrors, [], contractErrors.join('\n'))
})
