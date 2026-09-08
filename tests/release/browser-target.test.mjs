import assert from 'node:assert/strict'
import { test } from 'node:test'
import config from '../../frontend/vite.config.js'

test('Vite upgrade preserves the previous modules compilation floor', () => {
  assert.deepEqual(config.build.target, ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'])
})
