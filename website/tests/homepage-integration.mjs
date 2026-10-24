// Isolated Chrome CDP review; no package installation. Screenshots are written outside Git.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { calculateDeterministicMatch, deterministicResponse } from '../../server/matchingEngine.js'
const base=process.env.VITE_URL||'http://127.0.0.1:5175'
const debug=process.env.CHROME_URL||'http://127.0.0.1:9224'
const output=process.env.REVIEW_OUTPUT||'/tmp/roomroot-homepage-review'
await mkdir(output,{recursive:true})
const target=await(await fetch(debug+'/json/new?about:blank',{method:'PUT'})).json()
const socket=new WebSocket(target.webSocketDebuggerUrl)
await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}))
let id=0,deterministicRequests=0,aiRequests=0
const pending=new Map(),errors=[]
socket.addEventListener('message',event=>{
  const message=JSON.parse(event.data)
  if(message.id){const promise=pending.get(message.id);pending.delete(message.id);if(message.error)promise.reject(Error(JSON.stringify(message.error)));else promise.resolve(message.result)}
  if(message.method==='Runtime.exceptionThrown')errors.push(message.params)
  if(message.method==='Fetch.requestPaused')void mockApi(message.params).catch(error=>errors.push(String(error)))
})
function send(method,params={}){return new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});socket.send(JSON.stringify({id:key,method,params}))})}
async function evaluate(expression){const value=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(value.exceptionDetails)throw Error(JSON.stringify(value.exceptionDetails));return value.result.value}
const settle=()=>new Promise(resolve=>setTimeout(resolve,150))
async function waitFor(expression){for(let i=0;i<100;i++){if(await evaluate(expression)){await settle();return}await new Promise(resolve=>setTimeout(resolve,100))}throw Error('Timed out: '+expression)}
async function click(selector){await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);await settle()}
async function mockApi({requestId,request}){
 const isScore=request.url.endsWith('/deterministic')
 let result={error:'AI deliberately unavailable in this isolated integration test.'}
 if(request.method!=='OPTIONS'&&isScore){const input=JSON.parse(request.postData);result=deterministicResponse(calculateDeterministicMatch(input.seeker,input.host));deterministicRequests++}
 else if(request.method!=='OPTIONS')aiRequests++
 await send('Fetch.fulfillRequest',{requestId,responseCode:request.method==='OPTIONS'||isScore?200:503,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'},{name:'Access-Control-Allow-Headers',value:'Content-Type'},{name:'Access-Control-Allow-Methods',value:'POST, OPTIONS'}],body:Buffer.from(JSON.stringify(result)).toString('base64')})
}
async function screenshot(name){const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(output+'/'+name+'.png',Buffer.from(shot.data,'base64'))}
try{
 await send('Runtime.enable');await send('Page.enable')
 await send('Fetch.enable',{patterns:[{urlPattern:'http://localhost:3001/*',requestStage:'Request'}]})
 await send('Page.navigate',{url:base+'/#home'});await waitFor('!!document.querySelector(".hero-art img")')
 await evaluate("localStorage.removeItem('roomroot:housing-profile:v1');localStorage.removeItem('roomroot:rootspace:layout:v1')")
 if(!process.env.REVIEW_QUICK)for(const width of [1440,1024,768,390,320])for(const zoom of [.5,.75,1,1.25,1.5]){
  // Browser zoom changes the CSS layout viewport and device pixel ratio together.
  // CDP reproduces those layout conditions, rather than pinch-zoom or CSS transforms.
  await send('Emulation.setDeviceMetricsOverride',{width:Math.round(width/zoom),height:Math.round(1000/zoom),deviceScaleFactor:zoom,mobile:false})
  await evaluate('window.scrollTo(0,0)');await settle()
  const state=await evaluate(`(()=>{const img=document.querySelector('.hero-art img'),r=img.getBoundingClientRect(),box=img.parentElement.getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>window.innerWidth+1,width:r.width,height:r.height,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,box:box.width,transform:getComputedStyle(img).transform,animation:getComputedStyle(img).animationName,cards:[...document.querySelectorAll('.card-art')].map(card=>{const r=card.getBoundingClientRect(),p=card.querySelector('img').getBoundingClientRect();return {container:r.width,image:p.width,left:r.left,imageLeft:p.left}}),links:[...document.querySelectorAll('.main-nav a')].map(a=>({width:a.getBoundingClientRect().width,height:a.getBoundingClientRect().height}))}})()`)
  assert.equal(state.overflow,false,`horizontal overflow at ${width}px / ${zoom}`)
  assert.ok(state.width>0&&state.naturalWidth===960&&state.naturalHeight===760)
  assert.ok(Math.abs(state.width/state.height-960/760)<.01)
  assert.ok(state.width<=state.box&&state.box<=Math.round(width/zoom))
  assert.ok(state.cards.every(card=>Math.abs(card.image-card.container)<1&&Math.abs(card.left-card.imageLeft)<1),'sample image escaped its containing block');
  assert.equal(state.transform,'none');assert.equal(state.animation,'none');assert.ok(state.links.every(a=>a.height>=44&&a.width>0))
  await evaluate("document.querySelector('.hero-art').scrollIntoView({block:'center'})");await settle()
  const rect=await evaluate("(()=>{const r=document.querySelector('.hero-art img').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})()")
  for(const fraction of [.1,.5,.9]){await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:rect.x+rect.width*fraction,y:rect.y+rect.height/2,buttons:0});await settle();const after=await evaluate("(()=>{const r=document.querySelector('.hero-art img').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,transform:getComputedStyle(document.querySelector('.hero-art img')).transform}})()");assert.equal(after.transform,'none');for(const key of ['x','y','width','height'])assert.ok(Math.abs(after[key]-rect[key])<.1,'hover caused illustration layout shift')}
  if(zoom===1||width===1440){await evaluate('window.scrollTo(0,0)');await screenshot(`homepage-${width}-${Math.round(zoom*100)}`)}
 }
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1080,deviceScaleFactor:1,mobile:false})
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
 assert.equal(await evaluate("getComputedStyle(document.querySelector('.hero-art img')).animationName"),'none')
 await click('.main-nav a[href="#browse"]');assert.ok(await evaluate('!!document.querySelector("#browse")'))
 const card=await evaluate(`(()=>{const e=document.querySelector('.card-art');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})()`);await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:card.x+card.width/2,y:card.y+card.height/2,buttons:0});await new Promise(r=>setTimeout(r,350));assert.ok(await evaluate(`(()=>{const c=document.querySelector('.card-art').getBoundingClientRect(),i=document.querySelector('.card-art img').getBoundingClientRect();return i.width<=c.width*1.03&&Math.abs(i.x-c.x)<c.width*.03})()`),'card hover changed image containing block')
 await click('.main-nav a[href="#community"]');await click('.topic-chip input[value="Shared spaces"]');assert.match(await evaluate('document.querySelector(".community-post").textContent'),/Shared spaces/)
 await click('.main-nav a[href="#profile"]');await waitFor('!!document.querySelector(".housing-profile")')
 assert.equal(await evaluate('!!document.querySelector(".hero")'),false)
 await click('.skip-link');assert.equal(await evaluate('location.hash'),'#profile');assert.equal(await evaluate('document.activeElement.id'),'feature-content')
 await click('.main-nav a[href="#matches"]');assert.match(await evaluate('document.body.textContent'),/Complete your housing profile/)
 // The existing fictional preview supplies a valid completed questionnaire; no user data.
 await evaluate(`(async()=>{const m=await import('/src/features/housing-profile/index.ts');const p=await import('/src/features/roommate-matching/previewProfile.ts');const draft=m.createHousingProfile();draft.profile=p.createPreviewProfile();draft.completed=true;draft.step=6;draft.completedSections=[0,1,2,3,4,5];if(!m.saveHousingProfile(draft))throw Error('Invalid completed profile')})()`)
 await click('.main-nav a[href="#profile"]');await click('.main-nav a[href="#matches"]');await waitFor('!!document.querySelector(".rm-score")')
 assert.ok(deterministicRequests>0);assert.equal(aiRequests,0,'AI must be requested only on demand')
 await click('#rm-tab-coffee');await waitFor('!!document.querySelector(".rm-guide-source")');assert.ok(aiRequests>0)
 assert.match(await evaluate('document.querySelector(".rm-guide-source").textContent'),/profile-based guide/)
 assert.equal(await evaluate('document.querySelector("#rm-tab-coffee").getAttribute("aria-selected")'),'true')
 await evaluate('document.querySelector("#rm-tab-coffee").dispatchEvent(new KeyboardEvent("keydown",{key:"Home",bubbles:true}))')
 assert.equal(await evaluate('document.activeElement.id'),'rm-tab-compatibility')
 assert.equal(await evaluate('document.querySelector("#rm-tab-compatibility").getAttribute("aria-selected")'),'true')
 await click('.rm-save');assert.equal(await evaluate('document.querySelector(".rm-save").getAttribute("aria-pressed")'),'true')
 await click('.rm-like');assert.match(await evaluate('document.querySelector(".rm-stats").textContent'),/1 liked/)
 await screenshot('matching-integrated')
 await click('.main-nav a[href="#planner"]');await waitFor('!!document.querySelector(".rootspace canvas")')
 await evaluate("[...document.querySelectorAll('.rs-catalog button')].find(b=>b.textContent.includes('Desk')).click()");await settle()
 assert.equal(await evaluate("getComputedStyle(document.querySelector('.rootspace h2')).fontFamily.includes('Georgia')"),false,'homepage heading CSS leaked')
 await evaluate("[...document.querySelectorAll('.rs-tabs button')].find(b=>b.textContent.includes('3D')).click()");await waitFor('!!document.querySelector(".rs-viewer-3d canvas")')
 assert.equal(await evaluate('!!document.querySelector(".rs-viewer-3d > .rs-3d-unavailable")'),false)
 await screenshot('rootspace-integrated')
 await click('.main-nav a[href="#community"]');await waitFor('!!document.querySelector("#community")')
 await click('.brand[href="#home"]');await waitFor('!!document.querySelector(".hero-art img")')
 assert.equal(await evaluate("getComputedStyle(document.querySelector('.hero-art img')).transform"),'none')
 await evaluate('window.history.back()');await waitFor(`location.hash==='#community'`);assert.ok(await evaluate('!!document.querySelector("#community")'));await evaluate('window.history.forward()');await waitFor(`location.hash==='#home'`)
 assert.deepEqual(errors,[])
 console.log(process.env.REVIEW_QUICK?'PASS: focused navigation/feature checks;':'PASS: 25 width/zoom-layout combinations;', ' proportional SVG; no page overflow or hover shifts; usable navigation; reduced motion; fictional community interactions; incomplete/complete profile routing; deterministic matching, AI failure, Save/Like; RootSpace 2D/3D; feature style isolation. Screenshots:',output)
}finally{await send('Page.close');socket.close()}
