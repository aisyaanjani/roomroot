// Isolated Chrome CDP review; no package installation. Screenshots are written outside Git.
import assert from 'node:assert/strict'

const base=process.env.VITE_URL||'http://127.0.0.1:5173'
const debug=process.env.CHROME_URL||'http://127.0.0.1:9223'
const target=await(await fetch(debug+'/json/new?about:blank',{method:'PUT'})).json()
const socket=new WebSocket(target.webSocketDebuggerUrl)
await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}))
let id=0
const pending=new Map(),errors=[]
socket.addEventListener('message',event=>{
  const message=JSON.parse(event.data)
  if(message.id){const promise=pending.get(message.id);pending.delete(message.id);if(message.error)promise.reject(Error(JSON.stringify(message.error)));else promise.resolve(message.result)}
  if(message.method==='Runtime.exceptionThrown')errors.push(message.params)
  if(message.method==='Fetch.requestPaused')void send('Fetch.failRequest',{requestId:message.params.requestId,errorReason:'ConnectionRefused'})

})
function send(method,params={}){return new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});socket.send(JSON.stringify({id:key,method,params}))})}
async function evaluate(expression){const value=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(value.exceptionDetails)throw Error(JSON.stringify(value.exceptionDetails));return value.result.value}
const settle=()=>new Promise(resolve=>setTimeout(resolve,150))
async function waitFor(expression){for(let i=0;i<100;i++){if(await evaluate(expression)){await settle();return}await new Promise(resolve=>setTimeout(resolve,100))}throw Error('Timed out: '+expression)}
async function click(selector){await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);await settle()}
// Exercises the actual local backend, including its explicit missing-key response.
try {
 await send('Runtime.enable');await send('Page.enable')
 const health=await fetch('http://localhost:3001/health');assert.equal(health.status,200)
 const allowed=await fetch('http://localhost:3001/health',{headers:{Origin:base}});assert.equal(allowed.status,200);assert.equal(allowed.headers.get('access-control-allow-origin'),base)
 assert.equal((await fetch('http://localhost:3001/health',{headers:{Origin:'https://untrusted.invalid'}})).status,403)
 await send('Page.navigate',{url:base+'/#home'});await waitFor('!!document.querySelector(".hero-art img")')
 await evaluate("localStorage.removeItem('roomroot:housing-profile:v1')")
 await click('.main-nav a[href="#matches"]');assert.match(await evaluate('document.body.textContent'),/Complete your housing profile/)
 await click('.rr-next a[href="#profile"]');await waitFor('!!document.querySelector(".housing-profile")')
 await evaluate(`(async()=>{const m=await import('/src/features/housing-profile/index.ts');const p=await import('/src/features/roommate-matching/previewProfile.ts');const draft=m.createHousingProfile();draft.profile=p.createPreviewProfile();draft.completed=true;draft.step=6;draft.completedSections=[0,1,2,3,4,5];if(!m.saveHousingProfile(draft))throw Error('Invalid completed profile')})()`)
 await click('.main-nav a[href="#matches"]');await waitFor('!!document.querySelector(".rm-score")')
 assert.match(await evaluate('document.querySelector(".rm-score").textContent'),/\d+%/)
 assert.ok(await evaluate('document.querySelectorAll(".rm-progress-item").length===2'))
 assert.ok(await evaluate('document.querySelectorAll(".rm-mirror-card").length>0'))
 await click('#rm-tab-coffee');await waitFor('!!document.querySelector(".rm-guide-source")')
 assert.match(await evaluate('document.querySelector(".rm-guide-source").textContent'),/profile-based guide/)
 assert.ok(await evaluate('document.querySelector("#rm-panel-coffee ol").children.length>0'))
 await click('#rm-tab-compatibility')
 for(const width of [1440,1024,768,390,320]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await settle()
  assert.equal(await evaluate('document.documentElement.scrollWidth>window.innerWidth+1'),false,'matching overflow at '+width)
 }
 // Editing the saved questionnaire and returning must request fresh compatibility.
 await click('.main-nav a[href="#profile"]')
 await evaluate(`(()=>{const key='roomroot:housing-profile:v1';const draft=JSON.parse(localStorage.getItem(key));draft.completed=false;localStorage.setItem(key,JSON.stringify(draft))})()`)
 await click('.main-nav a[href="#matches"]');assert.match(await evaluate('document.body.textContent'),/Complete your housing profile/)
 // A network failure must show a useful error without blanking the interface.
 await click('.main-nav a[href="#profile"]')
 await evaluate(`(async()=>{const m=await import('/src/features/housing-profile/index.ts');const p=await import('/src/features/roommate-matching/previewProfile.ts');const draft=m.createHousingProfile();draft.profile=p.createPreviewProfile();draft.completed=true;draft.step=6;draft.completedSections=[0,1,2,3,4,5];if(!m.saveHousingProfile(draft))throw Error('Invalid completed profile')})()`)
 await send('Fetch.enable',{patterns:[{urlPattern:'http://localhost:3001/*',requestStage:'Request'}]})
 await click('.main-nav a[href="#matches"]');await waitFor('!!document.querySelector(".rm-alert[role=alert]")')
 assert.match(await evaluate('document.querySelector(".rm-alert[role=alert]").textContent'),/Matching service unavailable/)
 await send('Fetch.disable')
 assert.deepEqual(errors,[])
 console.log('PASS: actual local backend health/CORS; incomplete profile and working completion link; completed profile cards/scores; comparison tabs; missing-AI fallback guide; five responsive widths; profile refresh validation; network failure alert.')
} finally { await send('Page.close');socket.close() }
