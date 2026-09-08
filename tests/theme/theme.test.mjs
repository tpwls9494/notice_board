import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import assert from 'node:assert/strict'

const script = readFileSync(new URL('../../frontend/public/theme-init.js', import.meta.url), 'utf8')
function environment({ dark = false, jar = { value: '' }, blocked = false, host = 'jionc.com' } = {}) {
  const listeners = {}, mediaListeners = {}, docListeners = {}, intervals = [], storage = new Map()
  const root = { dataset: {}, style: {}, classList: { toggle: (_, value) => { root.dark = value } } }
  const media = { matches: dark, addEventListener: (name, callback) => { mediaListeners[name] = callback } }
  const document = { documentElement: root, hidden: false, querySelector: () => ({}),
    addEventListener: (name, callback) => { docListeners[name] = callback },
    get cookie() { if (blocked) throw Error('blocked'); return jar.value },
    set cookie(value) { if (blocked) throw Error('blocked'); jar.lastWrite = value; jar.value = value.split(';')[0] },
  }
  const window = { matchMedia: () => media,
    addEventListener: (name, callback) => { listeners[name] = callback },
    dispatchEvent: (event) => { listeners[event.type]?.(event) } }
  const localStorage = { getItem: key => { if (blocked) throw Error('blocked'); return storage.get(key) },
    setItem: (key, value) => { if (blocked) throw Error('blocked'); storage.set(key, value) } }
  vm.runInNewContext(script, { window, document, localStorage, location: { hostname: host, protocol: 'https:' },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail } },
    setInterval: callback => intervals.push(callback) })
  return { theme: window.JionTheme, root, media, listeners, mediaListeners, intervals, jar, storage }
}

test('both applications use identical early bootstrap', () => {
  assert.equal(script, readFileSync(new URL('../../frontend-blog/public/theme-init.js', import.meta.url), 'utf8'))
})
test('first paint follows device setting without writing a cookie', () => {
  const env = environment({ dark: true })
  assert.equal(env.root.dark, true)
  assert.equal(env.theme.get().preference, 'system')
  assert.equal(env.jar.lastWrite, undefined)
})
test('explicit light overrides OS dark and stores only an enum', () => {
  const env = environment({ dark: true })
  env.theme.set('light')
  assert.equal(env.root.dark, false)
  assert.match(env.jar.lastWrite, /^jion_theme=light;/)
  assert.match(env.jar.lastWrite, /Domain=jionc.com; Secure/)
  assert.doesNotMatch(env.jar.lastWrite, /session|token|email/)
  env.mediaListeners.change()
  assert.equal(env.root.dark, false)
})
test('system mode follows live device changes', () => {
  const env = environment()
  env.theme.set('system')
  env.media.matches = true; env.mediaListeners.change()
  assert.equal(env.root.dark, true)
})
test('main and blog synchronize preference in both directions', () => {
  const jar = { value: '' }
  const main = environment({ jar }), blog = environment({ jar, host: 'blog.jionc.com' })
  main.theme.set('dark'); blog.listeners.focus()
  assert.equal(blog.root.dark, true)
  blog.theme.set('light'); main.intervals[0]()
  assert.equal(main.root.dark, false)
  assert.equal(environment({ jar }).root.dark, false)
})
test('invalid cookie and invalid setter values are ignored', () => {
  const env = environment({ jar: { value: 'jion_theme=%3Cscript%3E' }, dark: true })
  env.theme.set('arbitrary-input')
  assert.equal(env.theme.get().preference, 'system')
  assert.equal(env.root.dark, true)
})
test('blocked storage still permits an in-memory toggle', () => {
  const env = environment({ blocked: true })
  env.theme.set('dark'); env.intervals[0]()
  assert.equal(env.root.dark, true)
})
test('local development never sets a production Domain cookie', () => {
  const env = environment({ host: 'localhost' })
  env.theme.set('dark')
  assert.doesNotMatch(env.jar.lastWrite, /Domain=/)
})

for (const dark of [false, true]) {
  test(`direct toggle starts from system ${dark ? 'dark' : 'light'} and retains explicit choice`, () => {
    const env = environment({ dark })
    assert.equal(env.theme.get().preference, 'system')
    env.theme.set(env.theme.get().resolved === 'dark' ? 'light' : 'dark')
    assert.equal(env.root.dark, !dark)
    env.mediaListeners.change()
    assert.equal(env.root.dark, !dark)
    env.theme.set(env.theme.get().resolved === 'dark' ? 'light' : 'dark')
    assert.equal(env.root.dark, dark)
  })
}
