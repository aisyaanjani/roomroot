import assert from 'node:assert/strict'
import { PerspectiveCamera, Vector3 } from 'three'
import { cameraFit } from '../cameraFit.ts'
import { feet, wallClearances } from '../measurements.ts'
import { surfaceTexture } from '../surfaceTexture.ts'
const item={id:'test',type:'desk',x:6,y:0,z:7,width:4,depth:2,height:2.5,rotation:0,color:'#d4bb96'}
assert.deepEqual(wallClearances(item,{width:12,length:14}),{north:6,east:4,south:6,west:4})
assert.deepEqual(wallClearances({...item,rotation:90},{width:12,length:14}),{north:5,east:5,south:5,west:5})
assert.equal(wallClearances({...item,x:2,z:1},{width:12,length:14}).west,0)
assert.equal(feet(1/3),'0.33 ft')
for(const width of [5,12,40])for(const length of [5,14,40])for(const height of [8,40])for(const aspect of [.65,1,1.36,2.4]){
  const fit=cameraFit(width,length,height,aspect)
  const camera=new PerspectiveCamera(45,aspect,.1,1000);camera.position.set(...fit.position);camera.lookAt(...fit.target);camera.updateMatrixWorld()
  let largest=0
  for(const x of [-.25,width+.25])for(const y of [-.25,height+.25])for(const z of [-.25,length+.25]){
    const p=new Vector3(x,y,z).project(camera)
    assert.ok(Math.abs(p.x)<=.880001&&Math.abs(p.y)<=.820001,`${width}×${length}×${height}, aspect ${aspect}: room clipped`)
    assert.ok(p.z>-1&&p.z<1);largest=Math.max(largest,Math.abs(p.x)/.88,Math.abs(p.y)/.82)
  }
  assert.ok(largest>.999,'framing uses available space instead of an oversized sphere')
}
for(const kind of ['wood','tile']){const texture=surfaceTexture(kind);assert.equal(texture.image.width,64);assert.equal(texture.image.data.length,64*64*4);assert.ok(new Set(texture.image.data).size>2);texture.dispose()}
console.log('PASS: all framing corners across 72 room/height/aspect combinations, fitted workspace occupancy, rotated wall clearances, units, lightweight procedural materials.')
