import assert from 'node:assert/strict'
import { collisions, freshLayout, addFurniture, openingError, parseLayout, resizeRoom } from '../model.ts'
import { historyReducer, initialHistory, HISTORY_LIMIT } from '../history.ts'
const layout=freshLayout(),desk=addFurniture(layout,'desk')
const chair={...addFurniture(layout,'chair'),x:desk.x+2.5}
assert.equal(collisions([desk,chair]).size,2)
assert.equal(collisions([{...desk,rotation:90},chair]).size,0)
assert.equal(collisions([desk,{...chair,x:desk.x+3}]).size,0,'touching edges are not overlaps')
const door={id:'door',type:'door',wall:'north',position:1,width:3,height:7,sill:0}
const window={id:'window',type:'window',wall:'north',position:5,width:3,height:4,sill:3}
assert.equal(openingError([door,window],layout.room),null)
for(const bad of [{...window,position:2},{...window,position:11},{...window,sill:5},{...door,sill:1},{...door,width:NaN},{...door,wall:'bad'}])assert.ok(openingError([door,bad],layout.room))
const customized={...layout,openings:[door,window],appearance:{wallColor:'#aabbcc',floorColor:'#ddeeff',floorMaterial:'tile'}}
assert.deepEqual(parseLayout(JSON.stringify(layout)),layout,'older v1 layouts remain unchanged')
assert.deepEqual(parseLayout(JSON.stringify(customized)),customized)
assert.throws(()=>resizeRoom(customized,{width:5,length:14}),'shrinking cannot cut off openings')
for(const extra of [{openings:[null]},{openings:[door,door]},{openings:[{...door,position:-1}]},{appearance:{wallColor:'red',floorColor:'#ddeeff',floorMaterial:'wood'}}])assert.throws(()=>parseLayout(JSON.stringify({...layout,...extra})))
let history=initialHistory({...layout,furniture:[desk]})
history=historyReducer(history,{type:'begin'})
for(let i=0;i<20;i++)history=historyReducer(history,{type:'update',value:l=>({...l,furniture:[{...desk,x:3+i*.1}]})})
assert.equal(history.past.length,0)
history=historyReducer(history,{type:'end'});assert.equal(history.past.length,1)
const moved=history.present
history=historyReducer(history,{type:'undo'});assert.deepEqual(history.present,{...layout,furniture:[desk]})
history=historyReducer(history,{type:'redo'});assert.deepEqual(history.present,moved)
history=historyReducer(history,{type:'begin'});history=historyReducer(history,{type:'end'});assert.equal(history.past.length,1,'click without drag is not a history step')
history=historyReducer(history,{type:'undo'});history=historyReducer(history,{type:'update',value:customized});assert.equal(history.future.length,0)
for(let i=0;i<100;i++)history=historyReducer(history,{type:'update',value:l=>({...l,room:{width:5+(i%35),length:14}})})
assert.equal(history.past.length,HISTORY_LIMIT)
console.log('PASS: rotated collisions, touching footprints, opening bounds/overlaps/heights, legacy/customized saves, malformed options, resize protection, drag transaction undo/redo/no-op/branching/history limit.')
