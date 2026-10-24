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
try{
await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1080,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:base+'/src/features/room-planner/preview.html'});await ready()
const catalog=await ev(`(async()=>{const m=await import('/src/features/room-planner/model.ts');return m.CATALOG})()`)
const furniture=catalog.map((c,i)=>({id:'polish-'+c.type,type:c.type,x:3+(i%5)*6,y:0,z:i<5?7:20,width:c.width,depth:c.depth,height:c.height,rotation:0,color:c.color}))
const layout={version:1,room:{width:30,length:30},furniture}
await ev(`localStorage.setItem('roomroot:rootspace:layout:v1',${JSON.stringify(JSON.stringify(layout))})`);await send('Page.reload');await ready()
await ev("[...document.querySelectorAll('summary')].find(s=>s.textContent==='Room finishes').click()");await settle()
await ev(`document.querySelector('button[aria-label="Wall: Soft sage"]').focus()`);await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await settle();assert.equal((await saved()).appearance.wallColor,'#c5cfb9');assert.equal(await ev(`document.querySelector('button[aria-label="Wall: Soft sage"]').getAttribute('aria-pressed')`),'true')
await click('Floor: Walnut');assert.equal((await saved()).appearance.floorColor,'#92745b');await click('Undo');assert.equal((await saved()).appearance.floorColor,'#d4bb96');await click('Redo');assert.equal((await saved()).appearance.floorColor,'#92745b')
await ev(`document.querySelector('.rs-materials button:nth-child(2)').click()`);await settle();assert.equal((await saved()).appearance.floorMaterial,'tile')
await ev(`document.querySelector('.rs-piece-list button').click()`);await settle();assert.equal(await ev('document.querySelectorAll(".rs-measurements dd").length'),4)
await click('3D room');await new Promise(r=>setTimeout(r,1200))
async function store(){await ev(`(async()=>{const fiber=await import(performance.getEntriesByType('resource').find(e=>e.name.includes('/@react-three_fiber.js'))?.name??'/node_modules/.vite/deps/@react-three_fiber.js');window.reviewStore=fiber._roots.get(document.querySelector('.rs-viewer-3d canvas')).store;window.reviewThree=await import('/node_modules/.vite/deps/three.js')})()`)}
await store()
assert.equal(await ev(`window.reviewStore.getState().scene.getObjectByName('room-floor').material.map.image.width`),64)
// Refined furniture must stay inside the saved size, including small detail meshes.
const bounds=await ev(`(()=>{const s=window.reviewStore.getState();return ${JSON.stringify(furniture)}.map(f=>{const model=s.scene.getObjectByName('furniture:'+f.id).children[0];model.updateWorldMatrix(true,true);const b=new window.reviewThree.Box3().setFromObject(model);return {id:f.id,size:b.getSize(new window.reviewThree.Vector3()).toArray(),min:b.min.toArray(),max:b.max.toArray()}})})()`)
for(let i=0;i<furniture.length;i++){const f=furniture[i],b=bounds[i];assert.ok(b.size[0]<=f.width+.001&&b.size[1]<=f.height+.001&&b.size[2]<=f.depth+.001,`${f.type} geometry exceeds saved dimensions`);assert.ok(b.min[1]>=-.001&&b.max[1]<=f.height+.001)}
const resources=await ev(`(()=>{const s=window.reviewStore.getState();let triangles=0;s.scene.traverse(o=>{if(o.isMesh&&o.geometry)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3});return {triangles,draws:s.gl.info.render.calls}})()`)
assert.ok(resources.triangles<10000,'procedural detail should remain lightweight')
if(process.env.SCREENSHOT_PATH){const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(process.env.SCREENSHOT_PATH,Buffer.from(shot.data,'base64'))}
// Exercise actual fitted cameras after room and viewport changes, not just the math helper.
for(const [width,length] of [[5,5],[5,40],[40,5],[40,40],[12,14]]){
 await fill('Room width',width);await fill('Room length',length);await click('Reset Camera')
 const projected=await ev(`(()=>{const s=window.reviewStore.getState();const corners=[];for(const x of [-.25,${width}+.25])for(const y of [-.25,8.25])for(const z of [-.25,${length}+.25])corners.push(new window.reviewThree.Vector3(x,y,z).project(s.camera).toArray());return corners})()`)
 assert.ok(projected.every(p=>Math.abs(p[0])<=.881&&Math.abs(p[1])<=.821),'actual room camera clips a corner')
}
// All three material modes are visually separate but keep the saved color.
await ev(`document.querySelector('.rs-materials button:nth-child(3)').click()`);await settle();assert.equal(await ev(`window.reviewStore.getState().scene.getObjectByName('room-floor').material.map===null`),true)
await ev(`document.querySelector('.rs-materials button:first-child').click()`);await settle();assert.equal((await saved()).appearance.floorMaterial,'wood')
const final=await saved();await click('2D planner');assert.deepEqual(await saved(),final);await send('Page.reload');await ready();assert.deepEqual(await saved(),final)
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await settle();await click('3D room');await new Promise(r=>setTimeout(r,700));await store();assert.equal(await ev('document.documentElement.scrollWidth<=window.innerWidth'),true)
const mobileCorners=await ev(`(()=>{const s=window.reviewStore.getState();const a=[];for(const x of [-.25,12.25])for(const y of [-.25,8.25])for(const z of [-.25,14.25])a.push(new window.reviewThree.Vector3(x,y,z).project(s.camera).toArray());return a})()`);assert.ok(mobileCorners.every(p=>Math.abs(p[0])<.881&&Math.abs(p[1])<.821))
assert.deepEqual(errors,[]);console.log('PASS: keyboard swatches, finishes and undo/redo, wall clearances, all furniture bounds and triangle budget, actual camera framing at room extremes, desktop/mobile fit, view switching, saved-layout restoration. Geometry:',resources)
}finally{await send('Page.close');socket.close()}
