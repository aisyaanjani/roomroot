import assert from 'node:assert/strict'
import { CATALOG, freshLayout, addFurniture, fitFurniture, footprint, parseLayout, resizeRoom } from '../model.ts'
function inside(f,room){const {w,d}=footprint(f);assert.ok(f.x-w/2>=-1e-8&&f.x+w/2<=room.width+1e-8);assert.ok(f.z-d/2>=-1e-8&&f.z+d/2<=room.length+1e-8)}
for(const width of [5,12,23.5,40])for(const length of [5,14,28.25,40]){
 let l=resizeRoom(freshLayout(),{width,length})
 for(const c of CATALOG){const f=addFurniture(l,c.type);inside(f,l.room);for(const rotation of [0,90,180,270])for(const x of [-100,0,10,100]){const next=fitFurniture({...f,rotation,x,z:x,width:35,depth:38},l.room);inside(next,l.room)}l={...l,furniture:[...l.furniture,f]}}
 assert.deepEqual(parseLayout(JSON.stringify(l)),l)
 const small=resizeRoom(l,{width:5,length:5});small.furniture.forEach(f=>inside(f,small.room))
}
for(const raw of ['broken','null','{}',JSON.stringify({...freshLayout(),version:2}),JSON.stringify({...freshLayout(),room:{width:4,length:14}}),JSON.stringify({...freshLayout(),furniture:[{id:'bad'}]})])assert.throws(()=>parseLayout(raw))
const l=freshLayout();const f=addFurniture(l,'desk');assert.throws(()=>parseLayout(JSON.stringify({...l,furniture:[f,f]})))
console.log('PASS: catalog dimensions, all quarter-turn bounds, out-of-room positions, 16 room sizes, oversized furniture fitting, storage round trips, malformed data, duplicate IDs.')
