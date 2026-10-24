import { memo } from 'react'
import type { Furniture } from './model'
import { useFurnitureDrag } from './useFurnitureDrag'
import type { DragActions } from './useFurnitureDrag'

// Geometry is built inside a unit footprint, then scaled by the saved feet dimensions.
function Part({at,size,color}:{at:[number,number,number];size:[number,number,number];color:string}) {
  return <mesh position={at} castShadow receiveShadow><boxGeometry args={size}/><meshStandardMaterial color={color} roughness={.78}/></mesh>
}
export const Furniture3D = memo(function Furniture3D({item,selected,onSelect,overlapping,...actions}:{item:Furniture;selected:boolean;overlapping:boolean;onSelect:(id:string)=>void}&DragActions) {
  const drag=useFurnitureDrag(item,onSelect,actions)
  const c=item.color, wood='#92765a', linen='#f4eee1'
  const legs=[-.38,.38].flatMap(x=>[-.36,.36].map(z=><Part key={`${x}:${z}`} at={[x,.43,z]} size={[.07,.86,.07]} color={wood}/>))
  let parts
  switch(item.type){
    case 'twin': case 'full': case 'queen':
      parts=<><Part at={[0,.2,0]} size={[1,.22,1]} color={wood}/><Part at={[0,.49,0]} size={[.96,.35,.95]} color={c}/><Part at={[0,.7,.18]} size={[.97,.12,.57]} color={c}/><Part at={[0,.5,-.47]} size={[1,1,.06]} color={c}/>{(item.type==='twin'? [0]:[-.23,.23]).map(x=><Part key={x} at={[x,.72,-.29]} size={[item.type==='twin'?.7:.4,.13,.22]} color={linen}/>)}</>;break
    case 'desk': case 'table':
      parts=<>{legs}<Part at={[0,.94,0]} size={[1,.12,1]} color={c}/>{item.type==='desk'&&<Part at={[.25,.76,-.03]} size={[.36,.25,.8]} color={c}/>}</>;break
    case 'chair':
      parts=<><Part at={[0,.47,0]} size={[.87,.14,.83]} color={c}/><Part at={[0,.77,-.35]} size={[.86,.46,.15]} color={c}/><Part at={[0,.23,0]} size={[.09,.46,.09]} color={wood}/><Part at={[0,.04,0]} size={[.92,.08,.12]} color={wood}/><Part at={[0,.04,0]} size={[.12,.08,.92]} color={wood}/>{[-.44,.44].map(x=><Part key={x} at={[x,.64,.02]} size={[.08,.07,.58]} color={wood}/>)}</>;break
    case 'sofa':
      parts=<><Part at={[0,.22,0]} size={[1,.3,.92]} color={c}/><Part at={[0,.7,-.37]} size={[1,.6,.25]} color={c}/>{[-.45,.45].map(x=><Part key={x} at={[x,.53,0]} size={[.1,.6,1]} color={c}/>)}{[-.27,0,.27].map(x=><Part key={x} at={[x,.47,.1]} size={[.26,.18,.7]} color={c}/>)}</>;break
    case 'bookshelf':
      parts=<><Part at={[0,.5,-.46]} size={[1,1,.08]} color={c}/>{[-.46,.46].map(x=><Part key={x} at={[x,.5,0]} size={[.08,1,1]} color={c}/>)}{[.025,.26,.5,.74,.975].map(y=><Part key={y} at={[0,y,0]} size={[1,.05,1]} color={c}/>)}{[.14,.38,.62].flatMap((y,row)=>[-.28,-.13,.05,.24].map((x,i)=><Part key={`${row}:${i}`} at={[x,y,-.03]} size={[.1,.16,.6]} color={['#a6b593','#d5bf9c','#e3d8c7','#7f9687'][i]!}/>))}</>;break
    case 'dresser': case 'nightstand':
      parts=<><Part at={[0,.5,0]} size={[1,1,1]} color={c}/>{(item.type==='dresser'?[.18,.48,.78]:[.28,.73]).map(y=><group key={y}><Part at={[0,y,.505]} size={[.89,.25,.015]} color={c}/><Part at={[0,y,.53]} size={[.18,.025,.035]} color={wood}/><Part at={[0,y-.14,.51]} size={[.92,.012,.02]} color={wood}/></group>)}</>;break
  }
  return <group {...drag} name={`furniture:${item.id}`} position={[item.x,item.y,item.z]} rotation={[0,-item.rotation*Math.PI/180,0]} onClick={e=>{if(e.delta>5)return;e.stopPropagation();onSelect(item.id)}}>
    <group scale={[item.width,item.height,item.depth]}>{parts}</group>
    {(selected||overlapping)&&<mesh position={[0,.018,0]} rotation={[-Math.PI/2,0,0]} raycast={()=>{}}><planeGeometry args={[item.width+.12,item.depth+.12]}/><meshBasicMaterial color={overlapping?'#bd804e':'#427852'} transparent opacity={.4} depthWrite={false}/></mesh>}
    {(selected||overlapping)&&<mesh position={[0,item.height/2,0]} raycast={()=>{}}><boxGeometry args={[item.width+.06,item.height+.06,item.depth+.06]}/><meshBasicMaterial color={overlapping?'#bd804e':'#386e46'} wireframe transparent opacity={.6}/></mesh>}
  </group>
})
