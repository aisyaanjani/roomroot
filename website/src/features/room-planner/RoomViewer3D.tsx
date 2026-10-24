import { Component, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ComponentRef, ReactNode } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei/core/OrbitControls'
import { MathUtils, PerspectiveCamera, Vector3 } from 'three'
import type { Layout } from './model'
import { Architecture3D } from './Architecture3D'
import { collisions } from './model'
import type { DragActions } from './useFurnitureDrag'
import { Furniture3D } from './Furniture3D'
import { cameraFit } from './cameraFit'

function Unavailable(){return <div className="rs-3d-unavailable" role="status"><strong>3D isn’t available right now.</strong><p>Your layout is safe. Switch to 2D to keep planning, or reload to try 3D again.</p></div>}
class ViewerBoundary extends Component<{children:ReactNode},{failed:boolean}>{
  state={failed:false}
  static getDerivedStateFromError(){return {failed:true}}
  render(){return this.state.failed?<Unavailable/>:this.props.children}
}
function Camera({layout,reset}:{layout:Layout;reset:number}){
  const controls=useRef<ComponentRef<typeof OrbitControls>>(null)
  const {camera,size,invalidate}=useThree()
  const width=layout.room.width,length=layout.room.length
  const height=Math.max(8,...layout.furniture.map(f=>f.y+f.height))
  const radius=Math.hypot(width,length,height)/2
  useLayoutEffect(()=>{
    if(!(camera instanceof PerspectiveCamera)||!controls.current)return
    const framing=cameraFit(width,length,height,size.width/size.height,camera.fov)
    const distance=framing.distance,target=new Vector3(...framing.target)
    camera.position.set(...framing.position)
    // OrbitControls and Three cameras require imperative updates outside React rendering.
    // oxlint-disable-next-line react/immutability
    camera.near=.1;camera.far=Math.max(500,distance*5);camera.updateProjectionMatrix()
    controls.current.target.copy(target);controls.current.minDistance=radius*.35;controls.current.maxDistance=distance*2
    controls.current.update();invalidate()
  },[camera,width,length,height,radius,size.width,size.height,reset,invalidate])
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={.12} minPolarAngle={.12} maxPolarAngle={Math.PI/2-.08} onChange={()=>{
    const c=controls.current;if(!c)return
    // Constrain pan while translating the camera equally so orientation stays stable.
    const x=MathUtils.clamp(c.target.x,0,width),z=MathUtils.clamp(c.target.z,0,length),y=MathUtils.clamp(c.target.y,0,height)
    camera.position.add(new Vector3(x-c.target.x,y-c.target.y,z-c.target.z));c.target.set(x,y,z)
  }}/>
}
function ContextMonitor({onFailure}:{onFailure:()=>void}){
  const {gl}=useThree()
  useEffect(()=>{const canvas=gl.domElement;const lost=(event:Event)=>{event.preventDefault();onFailure()};canvas.addEventListener('webglcontextlost',lost);return()=>canvas.removeEventListener('webglcontextlost',lost)},[gl,onFailure])
  return null
}
export default function RoomViewer3D({layout,selected,onSelect,...actions}:{layout:Layout;selected:string|null;onSelect:(id:string|null)=>void}&DragActions){
  const [reset,setReset]=useState(0)
  const [failed,setFailed]=useState(false)
  const width=layout.room.width,length=layout.room.length
  const overlaps=useMemo(()=>collisions(layout.furniture),[layout.furniture])
  const extent=Math.max(width,length,8,...layout.furniture.map(f=>f.height))
  return <div className="rs-viewer-3d" aria-label="Interactive 3D room viewer">
    {failed?<Unavailable/>:<ViewerBoundary><Canvas shadows dpr={[1,1.5]} frameloop="demand" camera={{fov:45,position:[24,24,24]}} fallback={<Unavailable/>} onPointerMissed={event=>{if(event.type==='click'&&event.target instanceof HTMLCanvasElement)onSelect(null)}}>
      <ContextMonitor onFailure={()=>setFailed(true)}/>
      <color attach="background" args={['#eef0e7']}/>
      <hemisphereLight args={['#fff8e8','#a7b39c',2]}/>
      <directionalLight position={[width*.3,extent*1.7,length*.7]} intensity={3} castShadow shadow-mapSize={[1024,1024]} shadow-camera-left={-extent} shadow-camera-right={extent} shadow-camera-top={extent} shadow-camera-bottom={-extent} shadow-camera-far={extent*5} shadow-normalBias={.04}/>
      <Architecture3D room={layout.room} openings={layout.openings} appearance={layout.appearance}/>
      {layout.furniture.map(item=><Furniture3D key={item.id} item={item} {...actions} overlapping={overlaps.has(item.id)} selected={selected===item.id} onSelect={onSelect}/>)}
      <Camera layout={layout} reset={reset}/>
    </Canvas></ViewerBoundary>}
    {layout.furniture.length===0&&<div className="rs-3d-empty"><strong>A new perspective on your space.</strong><span>Add a piece from the library, then drag it into place.</span></div>}
    <div className="rs-toolbar"><button title="Fit the whole room to this workspace" onClick={()=>setReset(v=>v+1)} disabled={failed}>↺ Reset Camera</button></div>
  </div>
}
