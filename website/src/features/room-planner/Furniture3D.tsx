import { memo, useMemo } from 'react'
import { Color } from 'three'
import type { Furniture } from './model'
import { useFurnitureDrag } from './useFurnitureDrag'
import type { DragActions } from './useFurnitureDrag'

// Every detail stays inside a unit box, scaled by saved width/height/depth in feet.
function Part({at,size,color,metal=false}:{at:[number,number,number];size:[number,number,number];color:string;metal?:boolean}) {
  return <mesh position={at} castShadow receiveShadow><boxGeometry args={size}/><meshStandardMaterial color={color} roughness={metal?.35:.78} metalness={metal?.45:0}/></mesh>
}
function SelectionOutline({item,color}:{item:Furniture;color:string}){
  const vertices=useMemo(()=>{
    const x=item.width/2+.025,z=item.depth/2+.025,h=item.height+.025
    const bottom=[[-x,.025,-z],[x,.025,-z],[x,.025,z],[-x,.025,z]]
    const top=bottom.map(([a,,c])=>[a,h,c])
    const edges=bottom.flatMap((p,i)=>[...p,...bottom[(i+1)%4]!])
    for(let i=0;i<4;i++){edges.push(...top[i]!,...top[(i+1)%4]!,...bottom[i]!,...top[i]!)}
    return new Float32Array(edges)
  },[item.width,item.depth,item.height])
  return <lineSegments raycast={()=>{}}><bufferGeometry><bufferAttribute attach="attributes-position" args={[vertices,3]}/></bufferGeometry><lineBasicMaterial color={color} transparent opacity={.65}/></lineSegments>
}
export const Furniture3D = memo(function Furniture3D({item,selected,onSelect,overlapping,...actions}:{item:Furniture;selected:boolean;overlapping:boolean;onSelect:(id:string)=>void}&DragActions) {
  const drag=useFurnitureDrag(item,onSelect,actions)
  const parts=useMemo(()=>{
  const c=item.color,wood='#92765a',linen='#f4eee1'
  const soft='#'+new Color(c).lerp(new Color(linen),.22).getHexString()
  const legs=[-.4,.4].flatMap(x=>[-.38,.38].map(z=><Part key={`${x}:${z}`} at={[x,.43,z]} size={[.055,.86,.055]} color={wood}/>))
  const shortFeet=[-.4,.4].flatMap(x=>[-.38,.38].map(z=><Part key={`${x}:${z}`} at={[x,.08,z]} size={[.07,.16,.07]} color={wood}/>))
  let parts
  switch(item.type){
    case 'twin': case 'full': case 'queen':
      parts=<>{shortFeet}<Part at={[0,.22,0]} size={[1,.16,1]} color={wood}/><Part at={[0,.37,.015]} size={[.96,.14,.95]} color={linen}/><Part at={[0,.5,.015]} size={[.95,.13,.94]} color="#fffaf0"/><Part at={[0,.59,.18]} size={[.96,.08,.6]} color={c}/><Part at={[0,.64,-.07]} size={[.96,.045,.12]} color={soft}/><Part at={[0,.59,-.47]} size={[1,.82,.06]} color={c}/><Part at={[0,.92,-.465]} size={[.91,.045,.07]} color={soft}/>{(item.type==='twin'?[0]:[-.23,.23]).map(x=><group key={x}><Part at={[x,.64,-.3]} size={[item.type==='twin'?.7:.4,.14,.21]} color={linen}/><Part at={[x,.715,-.3]} size={[item.type==='twin'?.65:.36,.01,.17]} color="#fffaf0"/></group>)}</>;break
    case 'desk': case 'table':
      parts=<>{legs}<Part at={[0,.94,0]} size={[1,.12,1]} color={c}/><Part at={[0,.85,-.38]} size={[.84,.08,.05]} color={wood}/>{item.type==='desk'?<><Part at={[.25,.74,0]} size={[.36,.27,.78]} color={c}/><Part at={[.25,.73,.397]} size={[.11,.018,.015]} color={wood} metal/></>:<Part at={[0,.82,0]} size={[.8,.08,.7]} color={wood}/>}</>;break
    case 'chair':
      parts=<><Part at={[0,.45,0]} size={[.88,.09,.83]} color={wood}/><Part at={[0,.52,0]} size={[.84,.09,.79]} color={c}/><Part at={[0,.76,-.37]} size={[.84,.48,.13]} color={wood}/><Part at={[0,.77,-.29]} size={[.76,.41,.04]} color={c}/><Part at={[0,.25,0]} size={[.08,.42,.08]} color={wood} metal/>{[-.43,.43].map(x=><group key={x}><Part at={[x,.56,-.2]} size={[.045,.24,.04]} color={wood}/><Part at={[x,.68,0]} size={[.09,.065,.58]} color={c}/></group>)}{Array.from({length:5},(_,i)=><group key={i} rotation={[0,i*Math.PI*2/5,0]}><Part at={[0,.08,.22]} size={[.055,.06,.44]} color={wood} metal/><mesh position={[0,.055,.43]} rotation={[0,0,Math.PI/2]} castShadow><cylinderGeometry args={[.045,.045,.07,8]}/><meshStandardMaterial color="#525c52" roughness={.8}/></mesh></group>)}</>;break
    case 'sofa':
      parts=<>{shortFeet}<Part at={[0,.28,0]} size={[1,.24,.94]} color={c}/><Part at={[0,.7,-.38]} size={[1,.6,.24]} color={c}/>{[-.45,.45].map(x=><Part key={x} at={[x,.55,0]} size={[.1,.6,1]} color={c}/>)}{[-.27,0,.27].map(x=><group key={x}><Part at={[x,.46,.1]} size={[.26,.17,.7]} color={soft}/><Part at={[x,.72,-.22]} size={[.26,.41,.12]} color={soft}/></group>)}<Part at={[-.33,.66,.08]} size={[.14,.23,.22]} color={linen}/></>;break
    case 'bookshelf':
      parts=<><Part at={[0,.5,-.47]} size={[1,1,.06]} color={soft}/>{[-.46,.46].map(x=><Part key={x} at={[x,.5,0]} size={[.08,1,1]} color={c}/>)}{[.025,.26,.5,.74,.975].map(y=><Part key={y} at={[0,y,0]} size={[1,.05,1]} color={c}/>)}{[.14,.38,.62,.86].flatMap((y,row)=>[-.29,-.16,.02,.22].map((x,i)=><Part key={`${row}:${i}`} at={[x,y,-.02]} size={[.08+(i%2)*.03,.15+(i%3)*.018,.55+(i%2)*.1]} color={['#a6b593','#d5bf9c','#e3d8c7','#7f9687'][(i+row)%4]!}/>))}</>;break
    case 'dresser': case 'nightstand':
      parts=<>{shortFeet}<Part at={[0,.58,0]} size={[1,.84,.96]} color={c}/><Part at={[0,.97,0]} size={[1,.06,1]} color={soft}/>{(item.type==='dresser'?[.3,.55,.8]:[.37,.75]).map(y=><group key={y}><Part at={[0,y,.483]} size={[.89,item.type==='dresser'?.22:.31,.02]} color={c}/><Part at={[0,y,.497]} size={[.18,.02,.006]} color={wood} metal/><Part at={[0,y-(item.type==='dresser'?.12:.17),.484]} size={[.9,.008,.02]} color={wood}/></group>)}</>;break
  }
  return parts
  },[item.type,item.color])
  const highlight=overlapping?'#bd804e':'#386e46'
  return <group {...drag} name={`furniture:${item.id}`} position={[item.x,item.y,item.z]} rotation={[0,-item.rotation*Math.PI/180,0]} onClick={e=>{if(e.delta>5)return;e.stopPropagation();onSelect(item.id)}}>
    <group scale={[item.width,item.height,item.depth]}>{parts}</group>
    {(selected||overlapping)&&<mesh position={[0,.018,0]} rotation={[-Math.PI/2,0,0]} raycast={()=>{}}><planeGeometry args={[item.width+.08,item.depth+.08]}/><meshBasicMaterial color={highlight} transparent opacity={.16} depthWrite={false}/></mesh>}
    {(selected||overlapping)&&<SelectionOutline item={item} color={highlight}/>}
  </group>
})
