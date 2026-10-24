import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { Plane, Vector3 } from 'three'
import type { Furniture } from './model'

export interface DragActions { onMove:(id:string,x:number,z:number)=>void; onDragStart:()=>void; onDragEnd:()=>void }
/** Ray/floor intersections preserve the grab offset independent of camera direction. */
export function useFurnitureDrag(item:Furniture,onSelect:(id:string)=>void,actions:DragActions){
  const {gl,get}=useThree()
  const active=useRef<{pointer:number;offset:Vector3;plane:Plane;capture:{setPointerCapture:(id:number)=>void;releasePointerCapture:(id:number)=>void};controls:{enabled:boolean}|null;enabled:boolean}|null>(null)
  const end=actions.onDragEnd
  useEffect(()=>{
    function finish(){const drag=active.current;if(!drag)return;active.current=null;if(drag.controls)drag.controls.enabled=drag.enabled;try{drag.capture.releasePointerCapture(drag.pointer)}catch{/* Capture can already be released by the browser. */}gl.domElement.style.cursor='';end()}
    const canvas=gl.domElement
    window.addEventListener('pointerup',finish);window.addEventListener('blur',finish)
    canvas.addEventListener('pointercancel',finish);canvas.addEventListener('lostpointercapture',finish)
    return()=>{finish();window.removeEventListener('pointerup',finish);window.removeEventListener('blur',finish);canvas.removeEventListener('pointercancel',finish);canvas.removeEventListener('lostpointercapture',finish)}
  },[gl,end])
  return {
    onPointerDown:(event:ThreeEvent<PointerEvent>)=>{
      if(event.button!==0||active.current)return
      event.stopPropagation()
      const plane=new Plane(new Vector3(0,1,0),-item.y),hit=event.ray.intersectPlane(plane,new Vector3())
      if(!hit)return
      const controls=get().controls as unknown as {enabled:boolean}|null
      active.current={pointer:event.pointerId,offset:hit.sub(new Vector3(item.x,item.y,item.z)),plane,capture:event.target as unknown as {setPointerCapture:(id:number)=>void;releasePointerCapture:(id:number)=>void},controls,enabled:controls?.enabled??true}
      if(controls)controls.enabled=false
      active.current.capture.setPointerCapture(event.pointerId)
      // Canvas cursor is an imperative DOM interaction, like OrbitControls.
      // oxlint-disable-next-line react/immutability
      gl.domElement.style.cursor='grabbing';onSelect(item.id);actions.onDragStart()
    },
    onPointerMove:(event:ThreeEvent<PointerEvent>)=>{
      const drag=active.current;if(!drag||event.pointerId!==drag.pointer)return
      event.stopPropagation()
      const hit=event.ray.intersectPlane(drag.plane,new Vector3());if(!hit)return
      hit.sub(drag.offset);actions.onMove(item.id,hit.x,hit.z)
    },
    onPointerUp:(event:ThreeEvent<PointerEvent>)=>{if(active.current)event.stopPropagation()},
  }
}
