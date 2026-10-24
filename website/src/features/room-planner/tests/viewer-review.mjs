// Start Vite and Chrome --headless=new --remote-debugging-port=9223 with a temporary profile.
// Run: node tests/browser-review.mjs (VITE_URL defaults to http://127.0.0.1:5175).
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
const base=process.env.VITE_URL||'http://127.0.0.1:5175'
const target=await(await fetch((process.env.CHROME_URL||'http://127.0.0.1:9223')+'/json/new?about:blank',{method:'PUT'})).json()
const socket=new WebSocket(target.webSocketDebuggerUrl)
await new Promise(r=>socket.addEventListener('open',r,{once:true}))
let id=0;const pending=new Map();const errors=[]
socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')console.error(m.params.args.map(a=>a.description||a.value).join(' '));if(m.method==='Runtime.exceptionThrown')errors.push(m.params);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(Error(JSON.stringify(m.error)));else p.resolve(m.result)}})
function send(method,params={}){return new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});socket.send(JSON.stringify({id:key,method,params}))})}
async function ev(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value}
const settle=()=>new Promise(r=>setTimeout(r,250))
async function click(text){await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.includes(${JSON.stringify(text)})||b.getAttribute('aria-label')===${JSON.stringify(text)});if(!b)throw Error('Missing '+${JSON.stringify(text)});b.click()})()`);await settle()}
async function fill(label,value){
if(label==='Furniture color'){await ev(`(()=>{const i=document.querySelector('input[aria-label="${label}"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,${JSON.stringify(String(value))});i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}))})()`);await settle();return}
await ev(`(()=>{const i=document.querySelector('input[aria-label="${label}"]');i.focus();i.select()})()`);await send('Input.insertText',{text:String(value)});await settle();await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await settle()
}
const saved=()=>ev("JSON.parse(localStorage.getItem('roomroot:rootspace:layout:v1'))")
async function ready(){for(let i=0;i<100;i++){if(await ev('!!document.querySelector(".rootspace canvas")')){await settle();return}await new Promise(r=>setTimeout(r,100))}throw Error('Preview did not load')}
async function mouse(type,x,y){await send('Input.dispatchMouseEvent',{type,x,y,button:'left',buttons:type==='mouseReleased'?0:1,clickCount:1})}
try{
await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1080,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:base+'/src/features/room-planner/preview.html'});await ready()
await ev("localStorage.removeItem('roomroot:rootspace:layout:v1')");await send('Page.reload');await ready();await click('Desk');const original=await saved();assert.match(await ev('document.querySelector(".rs-properties").textContent'),/Desk · Selected/);await click('3D room')
for(let i=0;i<100;i++){if(await ev('!!document.querySelector(".rs-viewer-3d canvas")'))break;await new Promise(r=>setTimeout(r,100))}await new Promise(r=>setTimeout(r,1500))
assert.equal(await ev('!!document.querySelector(".rs-viewer-3d > .rs-3d-unavailable")'),false)
assert.match(await ev('document.querySelector(".rs-properties").textContent'),/Desk · Selected/)
assert.deepEqual(await saved(),original)
// Access Fiber's exported root store to inspect actual rendered transforms, not duplicate app state.
await ev(`(async()=>{const fiber=await import(performance.getEntriesByType('resource').find(e=>e.name.includes('/@react-three_fiber.js'))?.name??'/node_modules/.vite/deps/@react-three_fiber.js');window.reviewStore=fiber._roots.get(document.querySelector('.rs-viewer-3d canvas')).store})()`)
const state=()=>ev(`(()=>{const s=window.reviewStore.getState();const f=s.scene.getObjectByName('furniture:${original.furniture[0].id}');return {position:f.position.toArray(),rotation:f.rotation.y,scale:f.children[0].scale.toArray(),camera:s.camera.position.toArray(),target:s.controls.target.toArray(),count:s.scene.children.filter(c=>c.name.startsWith('furniture:')).length}})()`)
let rendered=await state();assert.deepEqual(rendered.position,[6,0,7]);assert.deepEqual(rendered.scale,[4,2.5,2]);const initialCamera=rendered.camera
if(process.env.SCREENSHOT_PATH){const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(process.env.SCREENSHOT_PATH,Buffer.from(shot.data,'base64'))}
// Clear selection, then raycast-select the tabletop through a real pointer click.
await ev(`document.querySelector('.rs-piece-list button').click()`);await settle()
await click('2D planner');await click('3D room');await new Promise(r=>setTimeout(r,500))
await ev(`(async()=>{const fiber=await import(performance.getEntriesByType('resource').find(e=>e.name.includes('/@react-three_fiber.js'))?.name??'/node_modules/.vite/deps/@react-three_fiber.js');window.reviewStore=fiber._roots.get(document.querySelector('.rs-viewer-3d canvas')).store})()`)
await ev(`window.reviewStore.getState().events.handlers.onPointerMissed?.({type:'click'})`)
// Clicking blank space clears selection, leaving the shared properties panel empty.
let rect=await ev(`(()=>{const r=document.querySelector('.rs-viewer-3d canvas').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})()`)
await mouse('mousePressed',rect.x+5,rect.y+5);await mouse('mouseReleased',rect.x+5,rect.y+5);await settle();assert.equal(await ev('!!document.querySelector(".rs-no-selection")'),true)
const hit=await ev(`(async()=>{const {Vector3}=await import('/node_modules/.vite/deps/three.js');const s=window.reviewStore.getState();const p=new Vector3(6,2.5,7).project(s.camera);const r=s.gl.domElement.getBoundingClientRect();return {x:r.x+(p.x+1)*r.width/2,y:r.y+(1-p.y)*r.height/2}})()`)
await mouse('mousePressed',hit.x,hit.y);await mouse('mouseReleased',hit.x,hit.y);await settle();assert.match(await ev('document.querySelector(".rs-properties").textContent'),/Desk · Selected/)
await fill('Furniture width',5);await fill('Furniture depth',3);await fill('Furniture height',3);await fill('Furniture color','#bb8866');await click('Rotate 90');rendered=await state();assert.deepEqual(rendered.scale,[5,3,3]);assert.ok(Math.abs(rendered.rotation+Math.PI/2)<1e-8)
assert.equal(await ev(`window.reviewStore.getState().scene.getObjectByName('furniture:${original.furniture[0].id}').children[0].children.find(c=>c.isMesh&&c.geometry.parameters.width===1).material.color.getHexString()`),'bb8866')
const edited=await saved();await click('2D planner');assert.deepEqual(await saved(),edited);assert.match(await ev('document.querySelector(".rs-properties").textContent'),/Desk · Selected/)
await click('3D room');await new Promise(r=>setTimeout(r,500));await ev(`(async()=>{const fiber=await import(performance.getEntriesByType('resource').find(e=>e.name.includes('/@react-three_fiber.js'))?.name??'/node_modules/.vite/deps/@react-three_fiber.js');window.reviewStore=fiber._roots.get(document.querySelector('.rs-viewer-3d canvas')).store})()`)
rect=await ev(`(()=>{const r=document.querySelector('.rs-viewer-3d canvas').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})()`)
let before=(await state()).camera
// Stage 3: orbit from empty space; starting on furniture now drags it.
await mouse('mousePressed',rect.x+rect.width*.8,rect.y+rect.height*.15);await mouse('mouseMoved',rect.x+rect.width*.8+50,rect.y+rect.height*.15+30);await mouse('mouseReleased',rect.x+rect.width*.8+50,rect.y+rect.height*.15+30);await new Promise(r=>setTimeout(r,700));assert.notDeepEqual((await state()).camera,before)
await send('Input.dispatchMouseEvent',{type:'mouseWheel',x:rect.x+rect.width/2,y:rect.y+rect.height/2,deltaX:0,deltaY:-150});await new Promise(r=>setTimeout(r,700));assert.notDeepEqual((await state()).camera,before)
const panBefore=(await state()).target
await send('Input.dispatchMouseEvent',{type:'mousePressed',x:rect.x+200,y:rect.y+200,button:'right',buttons:2,clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:rect.x+230,y:rect.y+220,button:'right',buttons:2});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:rect.x+230,y:rect.y+220,button:'right',buttons:0,clickCount:1});await new Promise(r=>setTimeout(r,700));assert.notDeepEqual((await state()).target,panBefore)
await click('Reset Camera');await new Promise(r=>setTimeout(r,700));const reset=(await state()).camera;assert.ok(reset.every(Number.isFinite));assert.ok(reset.every((v,i)=>Math.abs(v-initialCamera[i])<.01))
// All catalog geometries mount in the same scene, then survive saved restoration.
for(const name of ['Twin bed','Full bed','Queen bed','Office chair','Sofa','Dresser','Nightstand','Dining table','Bookshelf'])await click(name)
assert.equal((await state()).count,10);const all=await saved()
await send('Page.reload');await ready();assert.deepEqual(await saved(),all);await click('3D room');await new Promise(r=>setTimeout(r,700))
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await settle();assert.equal(await ev('document.documentElement.scrollWidth<=window.innerWidth'),true);assert.ok(await ev('document.querySelector(".rs-viewer-3d canvas").width>0'))
// Simulate context loss: fallback must keep editing and the saved data intact.
await ev(`document.querySelector('.rs-viewer-3d canvas').dispatchEvent(new Event('webglcontextlost',{cancelable:true}))`);await settle();assert.equal(await ev('!!document.querySelector(".rs-viewer-3d > .rs-3d-unavailable")'),true);await click('2D planner');assert.deepEqual(await saved(),all)
assert.deepEqual(errors,[]);console.log('PASS: 3D WebGL rendering, shared transforms/color, real canvas raycast selection, editing, view/selection preservation, all catalog models, camera orbit/zoom/pan/reset, saved restoration, mobile layout, context-loss fallback, runtime errors.')
}finally{await send('Page.close');socket.close()}
