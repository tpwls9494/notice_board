import test from 'node:test'
import assert from 'node:assert/strict'
import { loadHomeSignals, selectHomeStories } from '../../frontend/src/utils/homeStories.js'

test('empty home has no invented lead', () => assert.deepEqual(selectHomeStories([]), { lead: null, stories: [] }))
test('an empty 48-hour selection falls back to latest without masking errors', async () => {
  const sorts = []
  const result = await loadHomeSignals(async ({sort}) => { sorts.push(sort); return { data: { items: sort === 'latest' ? [{id:1}] : [] } } })
  assert.deepEqual(sorts, ['important', 'latest'])
  assert.equal(result.data.items[0].id, 1)
  await assert.rejects(loadHomeSignals(async () => { throw Error('unavailable') }), /unavailable/)
})
test('explicit editorial selection wins over body fallback', () => {
  const items = [{ id: 1, body: 'Article' }, { id: 2, is_featured: true }]
  assert.equal(selectHomeStories(items).lead.id, 2)
  assert.deepEqual(selectHomeStories(items).stories.map(x => x.id), [1])
})
test('prefer an article without repeating it in the news list', () => {
  const items = [{ id: 1 }, { id: 2, body: 'Article' }, { id: 3 }]
  assert.equal(selectHomeStories(items).lead.id, 2)
  assert.deepEqual(selectHomeStories(items).stories.map(x => x.id), [1, 3])
})
test('legacy only, duplicate IDs and four-story cap are supported', () => {
  const items = [1, 1, 2, 3, 4, 5, 6, 7].map(id => ({ id, body: ' ' }))
  const original = JSON.stringify(items)
  assert.equal(selectHomeStories(items).lead.id, 1)
  assert.deepEqual(selectHomeStories(items).stories.map(x => x.id), [2, 3, 4, 5])
  assert.equal(JSON.stringify(items), original)
})
