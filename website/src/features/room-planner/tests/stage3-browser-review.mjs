// Start Vite and Chrome --headless=new --remote-debugging-port=9223 with a temporary profile.
// Run: node tests/browser-review.mjs (VITE_URL defaults to http://127.0.0.1:5175).
import assert from 'node:assert/strict'
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
const legacy={version:1,room:{width:12,length:14},furniture:[{id:'desk-review',type:'desk',x:6,y:0,z:7,width:4,depth:2,height:2.5,rotation:90,color:'#d7b58c'}]}
await ev(`localStorage.setItem('roomroot:rootspace:layout:v1',${JSON.stringify(JSON.stringify(legacy))})`);await send('Page.reload');await ready();assert.deepEqual(await saved(),legacy)
async function choose(label,value){await ev(`(()=>{const e=document.querySelector('[aria-label="${label}"]');e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}))})()`);await settle()}
async function details(text){await ev(`[...document.querySelectorAll('summary')].find(s=>s.textContent.includes(${JSON.stringify(text)})).click()`);await settle()}
async function color(label,value){await ev(`(()=>{const e=document.querySelector('[aria-label="${label}"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))})()`);await settle()}
async function shortcut(redo=false){await ev('document.activeElement.blur()');await send('Input.dispatchKeyEvent',{type:'keyDown',key:redo?'Z':'z',code:'KeyZ',modifiers:redo?10:2,windowsVirtualKeyCode:90});await send('Input.dispatchKeyEvent',{type:'keyUp',key:redo?'Z':'z',code:'KeyZ',modifiers:redo?10:2,windowsVirtualKeyCode:90});await settle()}
await details('Room finishes');await color('Wall color','#aabbcc');await color('Floor color','#bbaa88');await choose('Floor material','tile');assert.equal((await saved()).appearance.floorMaterial,'tile');await shortcut();assert.equal((await saved()).appearance.floorMaterial,'wood');await shortcut(true);assert.equal((await saved()).appearance.floorMaterial,'tile')
await details('Doors & windows');await click('Add opening');assert.equal((await saved()).openings.length,1)
await choose('Opening type','window');await fill('Opening position (ft)',2);await click('Add opening');assert.equal((await saved()).openings.length,1);assert.match(await ev('document.querySelector(".rs-options-body .rs-error").textContent'),/overlap/)
await fill('Opening position (ft)',10);await click('Add opening');assert.equal((await saved()).openings.length,1)
await fill('Opening position (ft)',5);await click('Add opening');assert.equal((await saved()).openings.length,2)
await fill('Room width',5);assert.equal((await saved()).room.width,12);assert.equal(await ev(`document.querySelector('input[aria-label="Room width"]').value`),'12')
// Editing opening position and wall uses the same placement validation.
await ev(`document.querySelectorAll('.rs-opening-row button')[2].click()`);await choose('Opening wall','west');await fill('Opening position (ft)',4);await click('Save opening');assert.equal((await saved()).openings[1].wall,'west')
await click('Office chair');assert.match(await ev('document.querySelector(".rs-collision-warning").textContent'),/2 pieces/);await click('Undo');assert.equal((await saved()).furniture.length,1);assert.equal(await ev('!!document.querySelector(".rs-collision-warning")'),false)
await click('3D room');await new Promise(r=>setTimeout(r,1200))
await ev(`(async()=>{const f=await import(performance.getEntriesByType('resource').find(e=>e.name.includes('/@react-three_fiber.js'))?.name??'/node_modules/.vite/deps/@react-three_fiber.js');window.reviewStore=f._roots.get(document.querySelector('.rs-viewer-3d canvas')).store;window.reviewThree=await import('/node_modules/.vite/deps/three.js')})()`)
const scene=async()=>ev(`(()=>{const s=window.reviewStore.getState();const f=s.scene.getObjectByName('furniture:desk-review');return {position:f.position.toArray(),rotation:f.rotation.y,scale:f.children[0].scale.toArray(),enabled:s.controls.enabled,wall:s.scene.getObjectByName('wall:north').children[0].children[0].material.color.getHexString(),floor:s.scene.getObjectByName('room-floor').material.color.getHexString(),door:!!s.scene.getObjectByName('opening:${(await saved()).openings[0].id}'),window:!!s.scene.getObjectByName('opening:${(await saved()).openings[1].id}')}})()`)
let rendered=await scene();assert.equal(rendered.wall,'aabbcc');assert.equal(rendered.floor,'bbaa88');assert.ok(rendered.door&&rendered.window)
async function projected(x,y,z){return ev(`(()=>{const s=window.reviewStore.getState();const p=new window.reviewThree.Vector3(${x},${y},${z}).project(s.camera);const r=s.gl.domElement.getBoundingClientRect();return {x:r.x+(p.x+1)*r.width/2,y:r.y+(1-p.y)*r.height/2}})()`)}
async function drag(dx,dy){const f=(await saved()).furniture[0];const p=await projected(f.x,2.5,f.z);await mouse('mousePressed',p.x,p.y);await settle();assert.equal((await scene()).enabled,false);const camera=await ev('window.reviewStore.getState().camera.position.toArray()');for(let i=1;i<=4;i++){await mouse('mouseMoved',p.x+dx*i/4,p.y+dy*i/4);await settle()}await mouse('mouseReleased',p.x+dx,p.y+dy);await settle();assert.equal((await scene()).enabled,true);assert.deepEqual(await ev('window.reviewStore.getState().camera.position.toArray()'),camera)}
const before=await saved();await drag(45,20);const moved=await saved();assert.notDeepEqual(moved.furniture[0],before.furniture[0]);assert.equal(moved.furniture[0].rotation,90);assert.equal(moved.furniture[0].width,4);assert.equal(moved.furniture[0].depth,2)
await click('Undo');assert.deepEqual(await saved(),before);await click('Redo');assert.deepEqual(await saved(),moved)
// Change camera quadrant and drag again: floor raycasting must remain correct.
await ev(`(()=>{const s=window.reviewStore.getState();s.camera.position.set(-15,24,-16);s.controls.target.set(6,2,7);s.controls.update();s.invalidate()})()`);await new Promise(r=>setTimeout(r,600));const secondBefore=await saved();await drag(80,60);assert.notDeepEqual((await saved()).furniture[0],secondBefore.furniture[0]);const f=(await saved()).furniture[0];assert.ok(f.x>=1&&f.x<=11&&f.z>=2&&f.z<=12)
// Pointer cancellation must release the camera and finish the transaction.
const p=await projected(f.x,2.5,f.z);await mouse('mousePressed',p.x,p.y);await settle();await ev(`document.querySelector('.rs-viewer-3d canvas').dispatchEvent(new Event('pointercancel'))`);await mouse('mouseReleased',p.x,p.y);await settle();assert.equal((await scene()).enabled,true)
await drag(350,150);const bounded=(await saved()).furniture[0];assert.ok(bounded.x>=1&&bounded.x<=11&&bounded.z>=2&&bounded.z<=12);assert.ok(Math.abs(bounded.x-1)<.01||Math.abs(bounded.x-11)<.01||Math.abs(bounded.z-2)<.01||Math.abs(bounded.z-12)<.01,'large drag reaches and clamps to a wall')
const final=await saved();await click('2D planner');assert.deepEqual(await saved(),final);await send('Page.reload');await ready();assert.deepEqual(await saved(),final)
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await settle();assert.equal(await ev('document.documentElement.scrollWidth<=window.innerWidth'),true);await click('3D room');await new Promise(r=>setTimeout(r,600));assert.equal(await ev('document.documentElement.scrollWidth<=window.innerWidth'),true)
await ev(`(async()=>{const fiber=await import(performance.getEntriesByType('resource').find(e=>e.name.includes('/@react-three_fiber.js'))?.name??'/node_modules/.vite/deps/@react-three_fiber.js');window.reviewStore=fiber._roots.get(document.querySelector('.rs-viewer-3d canvas')).store;window.reviewThree=await import('/node_modules/.vite/deps/three.js')})()`)
await click('Reset Camera');await new Promise(r=>setTimeout(r,400))
await ev(`document.querySelector('.rs-viewer-3d').scrollIntoView({block:'center'})`);await settle()
const mobileBefore=await saved();const mobilePiece=mobileBefore.furniture[0];const mobileHit=await projected(mobilePiece.x,2.5,mobilePiece.z)
await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:mobileHit.x,y:mobileHit.y,id:1}]});await settle();assert.equal((await scene()).enabled,false)
await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:mobileHit.x-25,y:mobileHit.y-20,id:1}]});await settle();await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await settle();assert.equal((await scene()).enabled,true);assert.notDeepEqual((await saved()).furniture[0],mobileBefore.furniture[0])
assert.deepEqual(errors,[]);console.log('PASS: legacy restoration, customization/history shortcuts, opening add/edit/overlap/bounds, protected room resize, collision warnings, 3D architecture, direct drag from two camera angles, controls locking/cancellation, gesture undo/redo, view synchronization, persistence, mobile layout and touch dragging.')
}finally{await send('Page.close');socket.close()}
