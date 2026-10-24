import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, Group } from 'three'
import { DEFAULT_APPEARANCE, wallLength } from './model'
import type { Layout, Opening, Wall } from './model'

function WallBlock({x,y,width,height,color}:{x:number;y:number;width:number;height:number;color:string}){
  if(width<=0||height<=0)return null
  return <mesh position={[x,y,0]} receiveShadow><boxGeometry args={[width,height,.2]}/><meshStandardMaterial color={color} roughness={.9}/></mesh>
}
function OpeningModel({opening:o}:{opening:Opening}){
  return <group name={`opening:${o.id}`} position={[o.position,0,0]}>
    {o.type==='door'?<mesh position={[o.width/2,o.height/2,0]} castShadow><boxGeometry args={[o.width-.1,o.height,.08]}/><meshStandardMaterial color="#bba382" roughness={.8}/></mesh>:<>
      <mesh position={[o.width/2,o.sill+o.height/2,0]}><boxGeometry args={[o.width,o.height,.06]}/><meshStandardMaterial color="#b8d7db" transparent opacity={.6} roughness={.15}/></mesh>
      <mesh position={[o.width/2,o.sill+o.height/2,.04]}><boxGeometry args={[.045,o.height,.05]}/><meshStandardMaterial color="#f6f0e1"/></mesh>
      <mesh position={[o.width/2,o.sill+o.height/2,.04]}><boxGeometry args={[o.width,.045,.05]}/><meshStandardMaterial color="#f6f0e1"/></mesh>
    </>}
    {[0,o.width].map(x=><mesh key={x} position={[x,o.sill+o.height/2,0]}><boxGeometry args={[.08,o.height+.12,.3]}/><meshStandardMaterial color="#fff9eb"/></mesh>)}
    {[o.sill,o.sill+o.height].filter(y=>y>0).map(y=><mesh key={y} position={[o.width/2,y,0]}><boxGeometry args={[o.width+.08,.08,.3]}/><meshStandardMaterial color="#fff9eb"/></mesh>)}
    {o.type==='door'&&<mesh position={[o.width-.23,o.height*.45,.09]}><sphereGeometry args={[.065,8,8]}/><meshStandardMaterial color="#8a794c" metalness={.5}/></mesh>}
  </group>
}
function WallGeometry({layout,wall}:{layout:Layout;wall:Wall}){
  const ref=useRef<Group>(null)
  const {width,length}=layout.room
  const openings=(layout.openings??[]).filter(o=>o.wall===wall).sort((a,b)=>a.position-b.position)
  const span=wallLength(wall,layout.room),color=(layout.appearance??DEFAULT_APPEARANCE).wallColor
  const gaps=[];let start=0
  for(const o of openings){gaps.push({start,width:o.position-start});start=o.position+o.width}
  gaps.push({start,width:span-start})
  useFrame(({camera})=>{if(ref.current)ref.current.visible=wall==='north'?camera.position.z>=length/2:wall==='south'?camera.position.z<length/2:wall==='west'?camera.position.x>=width/2:camera.position.x<width/2})
  const vertical=wall==='east'||wall==='west'
  return <group ref={ref} name={`wall:${wall}`} position={[wall==='east'?width:0,0,wall==='south'?length:0]} rotation={[0,vertical?-Math.PI/2:0,0]}>
    {gaps.map((g,i)=><group key={i}><WallBlock x={g.start+g.width/2} y={4} width={g.width} height={8} color={color}/><WallBlock x={g.start+g.width/2} y={.13} width={g.width} height={.26} color="#fcf8ed"/></group>)}
    {openings.map(o=><group key={o.id}><WallBlock x={o.position+o.width/2} y={o.sill/2} width={o.width} height={o.sill} color={color}/><WallBlock x={o.position+o.width/2} y={(8+o.sill+o.height)/2} width={o.width} height={8-o.sill-o.height} color={color}/><OpeningModel opening={o}/></group>)}
  </group>
}
export function Architecture3D({layout}:{layout:Layout}){
  const {width,length}=layout.room
  const {floorColor,floorMaterial}=layout.appearance??DEFAULT_APPEARANCE
  const plank=(i:number)=>'#'+new Color(floorColor).multiplyScalar([1.03,.97,1][i%3]!).getHexString()
  return <>
    <mesh name="room-floor" position={[width/2,-.12,length/2]} receiveShadow><boxGeometry args={[width,.24,length]}/><meshStandardMaterial color={floorColor} roughness={.85}/></mesh>
    {floorMaterial==='wood'&&Array.from({length:Math.ceil(width/.65)},(_,i)=><mesh key={i} position={[i*.65+Math.min(.65,width-i*.65)/2,.002,length/2]} rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[Math.min(.64,width-i*.65),length]}/><meshStandardMaterial color={plank(i)} roughness={.88}/></mesh>)}
    {floorMaterial==='tile'&&<>{Array.from({length:Math.ceil(width/2)-1},(_,i)=><mesh key={'x'+i} position={[(i+1)*2,.003,length/2]}><boxGeometry args={[.025,.005,length]}/><meshStandardMaterial color="#aca99a"/></mesh>)}{Array.from({length:Math.ceil(length/2)-1},(_,i)=><mesh key={'z'+i} position={[width/2,.003,(i+1)*2]}><boxGeometry args={[width,.005,.025]}/><meshStandardMaterial color="#aca99a"/></mesh>)}</>}
    {(['north','south','east','west'] as const).map(wall=><WallGeometry key={wall} wall={wall} layout={layout}/>)}
  </>
}
