// Run with Vite on port 5173 and an isolated Chrome debugging profile on port 9223.
import assert from 'node:assert/strict'

const base = process.env.VITE_URL || 'http://127.0.0.1:5173'
const debug = process.env.CHROME_URL || 'http://127.0.0.1:9223'
const target = await (await fetch(`${debug}/json/new?about:blank`, { method: 'PUT' })).json()
const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }))
let id = 0
const pending = new Map()
const errors = []
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data)
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params)
  if (message.id) {
    const callbacks = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) callbacks.reject(Error(JSON.stringify(message.error)))
    else callbacks.resolve(message.result)
  }
})
function send(method, params = {}) { return new Promise((resolve, reject) => { const key = ++id; pending.set(key, { resolve, reject }); socket.send(JSON.stringify({ id: key, method, params })) }) }
async function evaluate(expression) { const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true }); if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails)); return result.result.value }
const settle = () => new Promise(resolve => setTimeout(resolve, 100))
async function waitFor(expression) { for (let attempt = 0; attempt < 100; attempt++) { if (await evaluate(expression)) { await settle(); return } await settle() } throw Error(`Timed out: ${expression}`) }
async function click(text) { await evaluate(`(()=>{const button=[...document.querySelectorAll('button')].find(item=>item.textContent.trim()===${JSON.stringify(text)});if(!button)throw Error('Missing button');button.click()})()`); await settle() }
async function upload(contents, name = 'roomroot-housing-profile.json', type = 'application/json') {
  await evaluate(`(()=>{const input=document.querySelector('.hp-import input[type=file]');const transfer=new DataTransfer();transfer.items.add(new File([${JSON.stringify(contents)}],${JSON.stringify(name)},{type:${JSON.stringify(type)}}));Object.defineProperty(input,'files',{configurable:true,value:transfer.files});input.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await settle()
}

try {
  await send('Runtime.enable')
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: `${base}/#profile` })
  await waitFor('!!document.querySelector(".housing-profile")')
  await evaluate("localStorage.clear();sessionStorage.clear();location.reload()")
  await waitFor('!!document.querySelector(".hp-import-trigger")')

  const profile = await evaluate(`(async()=>{const module=await import('/src/features/housing-profile/questions.ts');const draft=module.createHousingProfile();draft.step=1;draft.completedSections=[0];Object.assign(draft.profile.housingBasics,{city:'Blacksburg',state:'VA',transportation:'Walking',moveInDate:'2027-08-15',lease:'12 months'});return JSON.stringify(draft)})()`)

  await upload(profile)
  await waitFor('!!document.querySelector(".hp-import-preview")')
  assert.equal(await evaluate('document.activeElement?.textContent'), 'Preview imported profile')
  assert.match(await evaluate('document.querySelector(".hp-import-preview").textContent'), /Blacksburg, VA/)
  await click('Cancel')
  assert.equal(await evaluate('!!document.querySelector(".hp-import-preview")'), false)
  assert.equal(await evaluate('document.activeElement?.textContent'), 'Import Profile')

  await upload(profile)
  await waitFor('!!document.querySelector(".hp-import-preview")')
  await evaluate("document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))")
  await settle()
  assert.equal(await evaluate('!!document.querySelector(".hp-import-preview")'), false)
  assert.equal(await evaluate('document.activeElement?.textContent'), 'Import Profile')

  await upload('not json', 'profile.txt', 'text/plain')
  await waitFor('!!document.querySelector(".hp-import-error")')
  assert.match(await evaluate('document.querySelector(".hp-import-error").textContent'), /JSON profile backup/)

  await upload(profile)
  await waitFor('!!document.querySelector(".hp-import-preview")')
  await click('Replace current profile')
  assert.equal(await evaluate("JSON.parse(localStorage.getItem('roomroot:housing-profile:v1')).profile.housingBasics.city"), 'Blacksburg')
  assert.equal(await evaluate('!!document.querySelector(".hp-import-preview")'), false)
  assert.equal(await evaluate('document.activeElement?.textContent'), 'Import Profile')
  assert.equal(await evaluate('!!document.querySelector(".hp-undo-import")'), true)

  await evaluate("location.hash='home'")
  await waitFor('!!document.querySelector(".rr-homepage")')
  await evaluate("location.hash='profile'")
  await waitFor('!!document.querySelector(".housing-profile")')
  assert.equal(await evaluate('!!document.querySelector(".hp-undo-import")'), true)
  await click('Undo import')
  assert.equal(await evaluate("JSON.parse(localStorage.getItem('roomroot:housing-profile:v1')).profile.housingBasics.city"), '')
  assert.equal(await evaluate("sessionStorage.getItem('roomroot:housing-profile:import-undo:v1')"), null)

  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true })
  await send('Page.reload')
  await waitFor('!!document.querySelector(".hp-import-trigger")')
  assert.equal(await evaluate('document.documentElement.scrollWidth <= 375'), true)
  assert.equal(await evaluate('document.querySelector(".hp-import-trigger").getBoundingClientRect().width >= 44'), true)
  assert.deepEqual(errors, [])
  console.log('PASS: import selection, preview/focus, Cancel, Escape, errors, replacement, route remount, session undo, desktop and 375px mobile layout.')
} finally {
  try { await send('Browser.close') } catch {}
  socket.close()
}
