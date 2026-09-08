import test from 'node:test'
import assert from 'node:assert/strict'
import { signalPublicationDate, formatSourceDate } from '../../frontend/src/utils/signalDates.js'

test('site date never becomes the old paper date', () => {
  assert.equal(signalPublicationDate({ source_published_at: '2021-06-17T00:00:00Z', published_at: '2026-09-07T08:00:00Z' }), '2026-09-07T08:00:00Z')
})
test('creation date is a fallback, never a fabricated current date', () => {
  assert.equal(signalPublicationDate({ created_at: '2026-09-06T08:00:00Z' }), '2026-09-06T08:00:00Z')
  assert.equal(signalPublicationDate({ source_published_at: '2021-06-17T00:00:00Z' }), null)
})
test('source date is separate and invalid input is hidden', () => {
  assert.match(formatSourceDate('2021-06-17T00:00:00Z'), /2021/)
  assert.equal(formatSourceDate('invalid'), '')
})
