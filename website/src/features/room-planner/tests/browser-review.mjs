// Start Vite and Chrome --headless=new --remote-debugging-port=9223 with a temporary profile.
// Run: node tests/browser-review.mjs (VITE_URL defaults to http://127.0.0.1:5175).
import assert from 'node:assert/strict'
const base=process.env.VITE_URL||'http://127.0.0.1:5175'
const target=await(await fetch('http://127.0.0.1:9223/json/new?about:blank',{method:'PUT'})).json()
const socket=new WebSocket(target.webSocketDebuggerUrl)
await new Promise(r=>socket.addEventListener('open',r,{once:true}))
let id=0;const pending=new Map();const errors=[]
socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(Error(JSON.stringify(m.error)));else p.resolve(m.result)}})
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
async function point(f){return ev(`(()=>{const r=document.querySelector('.rs-canvas').getBoundingClientRect();const room=${JSON.stringify((await saved()).room)};const scale=Math.min((r.width-104)/room.width,(r.height-112)/room.length)*Number(document.querySelector('.rs-toolbar>span').textContent.replace('%',''))/100;return {x:r.x+(r.width-room.width*scale)/2+${f.x}*scale,y:r.y+(r.height-room.length*scale)/2+${f.z}*scale}})()`)}
try{
await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1080,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:base+'/src/features/room-planner/preview.html'});await ready()
await ev("localStorage.removeItem('roomroot:rootspace:layout:v1')");await send('Page.reload');await ready()
assert.deepEqual((await saved()).room,{width:12,length:14})
for(const name of ['Twin bed','Full bed','Queen bed','Desk','Office chair','Sofa','Dresser','Nightstand','Dining table','Bookshelf'])await click(name)
assert.equal((await saved()).furniture.length,10)
await ev("[...document.querySelectorAll('.rs-piece-list button')].find(b=>b.textContent.startsWith('Queen bed')).click()");await settle();await click('Rotate 90');let f=(await saved()).furniture.find(f=>f.type==='queen');assert.equal(f.rotation,90)
await fill('Furniture width',4);await fill('Furniture depth',5);await fill('Furniture height',3);f=(await saved()).furniture.find(f=>f.type==='queen');assert.equal(f.width,4);assert.equal(f.depth,5);assert.equal(f.height,3)
await fill('Furniture color','#bb8866');assert.equal((await saved()).furniture.find(f=>f.type==='queen').color,'#bb8866')
await click('Duplicate piece');assert.equal((await saved()).furniture.length,11);await click('Delete piece');assert.equal((await saved()).furniture.length,10)
// Remove all but a single desk to exercise physical canvas selection and dragging without overlap.
await ev(`localStorage.setItem('roomroot:rootspace:layout:v1',JSON.stringify({version:1,room:{width:12,length:14},furniture:[${JSON.stringify((await saved()).furniture.find(f=>f.type==='desk'))}]}))`);await send('Page.reload');await ready()
f=(await saved()).furniture[0];let p=await point(f);await mouse('mousePressed',p.x,p.y);await mouse('mouseReleased',p.x,p.y);await settle();assert.match(await ev("document.querySelector('.rs-properties').textContent"),/Desk · Selected/)
await mouse('mousePressed',p.x,p.y);await mouse('mouseMoved',p.x+30,p.y+20);await mouse('mouseMoved',p.x+60,p.y+40);await mouse('mouseReleased',p.x+60,p.y+40);await settle();assert.notEqual((await saved()).furniture[0].x,f.x)
f=(await saved()).furniture[0];p=await point(f);await mouse('mousePressed',p.x,p.y);await mouse('mouseMoved',p.x+300,p.y+250);await mouse('mouseReleased',p.x+300,p.y+250);await settle();f=(await saved()).furniture[0];assert.ok(f.x+f.width/2<=12+.001&&f.z+f.depth/2<=14+.001)
// Drag after zoom and a pan: use the same screen displacement as the view pan.
await click('Zoom in');await click('Pan');
const box=await ev(`(()=>{const r=document.querySelector('.rs-canvas').getBoundingClientRect();return {x:r.x+18,y:r.y+40}})()`)
await mouse('mousePressed',box.x,box.y);await mouse('mouseMoved',box.x+25,box.y+20);await mouse('mouseReleased',box.x+25,box.y+20);await settle();await click('Pan')
f=(await saved()).furniture[0];p=await point(f);p.x+=25;p.y+=20;
await mouse('mousePressed',p.x,p.y);await mouse('mouseMoved',p.x-45,p.y-45);await mouse('mouseReleased',p.x-45,p.y-45);await settle();assert.ok((await saved()).furniture[0].x<f.x);await click('Fit room')
const before=await saved();await send('Page.reload');await ready();assert.deepEqual(await saved(),before)
await fill('Room width',4);assert.equal((await saved()).room.width,12);assert.equal(await ev(`document.querySelector('input[aria-label="Room width"]').getAttribute('aria-invalid')`),'true')
await fill('Room width',5);await fill('Room length',5);assert.deepEqual((await saved()).room,{width:5,length:5});await fill('Room width',40);await fill('Room length',40);assert.deepEqual((await saved()).room,{width:40,length:40})
await click('Zoom in');await click('Zoom out');await click('Fit room');assert.equal(await ev("document.querySelector('.rs-toolbar>span').textContent"),'100%')
await ev("localStorage.setItem('roomroot:rootspace:layout:v1','broken')");await send('Page.reload');await ready();assert.deepEqual((await saved()).room,{width:12,length:14});assert.match(await ev('document.body.textContent'),/could not be read/)
await click('Desk');await ev('window.confirm=()=>false');await click('Reset Room');assert.equal((await saved()).furniture.length,1);await ev('window.confirm=()=>true');await click('Reset Room');assert.equal((await saved()).furniture.length,0)
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await settle();assert.equal(await ev('document.documentElement.scrollWidth<=window.innerWidth'),true)
assert.deepEqual(errors,[]);console.log('PASS: all 10 additions, canvas selection/drag/bounds, rotation, dimensions/color, duplicate/delete, persistence, 5–40 ft rooms, invalid input, zoom, malformed storage, reset confirmation, mobile overflow, runtime errors.')
}finally{await send('Page.close');socket.close()}
