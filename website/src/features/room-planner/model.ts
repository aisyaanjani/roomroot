/** Feet throughout. Origin: northwest floor corner; +x east, +z south, +y up.
 * Furniture positions are floor-centered; positive rotation turns +x toward +z.
 * A Three.js viewer can use rotation.y = -rotation * Math.PI / 180.
 */
export type FurnitureType = 'twin' | 'full' | 'queen' | 'desk' | 'chair' | 'sofa' | 'dresser' | 'nightstand' | 'table' | 'bookshelf'
export interface Furniture { id: string; type: FurnitureType; x: number; y: number; z: number; width: number; depth: number; height: number; rotation: number; color: string }
export type Wall = 'north'|'south'|'east'|'west'
export interface Opening { id:string; type:'door'|'window'; wall:Wall; position:number; width:number; height:number; sill:number }
export interface Appearance { wallColor:string; floorColor:string; floorMaterial:'wood'|'tile'|'plain' }
// Optional additive fields preserve all existing version-1 layouts and the storage key.
export interface Layout { version: 1; room: { width: number; length: number }; furniture: Furniture[]; openings?:Opening[]; appearance?:Appearance }
export const DEFAULT_APPEARANCE:Appearance={wallColor:'#e9e5d8',floorColor:'#d4bb96',floorMaterial:'wood'}
export const wallLength=(wall:Wall,room:Layout['room'])=>wall==='north'||wall==='south'?room.width:room.length
export function openingError(openings:Opening[],room:Layout['room']):string|null {
  if(openings.length>100)return 'A room can contain up to 100 doors and windows.'
  const ids=new Set<string>()
  for(const o of openings){
    if(!o||typeof o.id!=='string'||!o.id||ids.has(o.id)||!['door','window'].includes(o.type)||!['north','south','east','west'].includes(o.wall))return 'Invalid door or window.'
    ids.add(o.id)
    if(![o.position,o.width,o.height,o.sill].every(Number.isFinite)||o.position<0||o.width<1||o.height<1||o.sill<0||o.sill+o.height>8||o.position+o.width>wallLength(o.wall,room)||o.type==='door'&&o.sill!==0)return 'Openings must fit within the wall (8 ft high).'
  }
  for(let i=0;i<openings.length;i++)for(let j=i+1;j<openings.length;j++){
    const a=openings[i]!,b=openings[j]!
    if(a.wall===b.wall&&a.position<b.position+b.width-.000001&&b.position<a.position+a.width-.000001)return 'Doors and windows cannot overlap on the same wall.'
  }
  return null
}
export function collisions(furniture:Furniture[]):Set<string>{
  const result=new Set<string>()
  // Supported rotations are quarter turns, so rotated footprints are exact AABBs.
  for(let i=0;i<furniture.length;i++)for(let j=i+1;j<furniture.length;j++){
    const a=furniture[i]!,b=furniture[j]!,af=footprint(a),bf=footprint(b)
    if(Math.abs(a.x-b.x)<(af.w+bf.w)/2-1e-6&&Math.abs(a.z-b.z)<(af.d+bf.d)/2-1e-6){result.add(a.id);result.add(b.id)}
  }
  return result
}
export const STORAGE_KEY = 'roomroot:rootspace:layout:v1'
export const CATALOG: { type: FurnitureType; name: string; width: number; depth: number; height: number; color: string; icon: string }[] = [
  {type:'twin',name:'Twin bed',width:3.25,depth:6.25,height:2,color:'#b5c5b2',icon:'▤'},
  {type:'full',name:'Full bed',width:4.5,depth:6.25,height:2,color:'#b5c5b2',icon:'▤'},
  {type:'queen',name:'Queen bed',width:5,depth:6.67,height:2,color:'#a4b8a3',icon:'▤'},
  {type:'desk',name:'Desk',width:4,depth:2,height:2.5,color:'#d7b58c',icon:'▱'},
  {type:'chair',name:'Office chair',width:2,depth:2,height:3.2,color:'#a6b8bd',icon:'◉'},
  {type:'sofa',name:'Sofa',width:7,depth:3,height:2.8,color:'#b6bf9f',icon:'▥'},
  {type:'dresser',name:'Dresser',width:4.5,depth:1.67,height:3,color:'#cfac88',icon:'▦'},
  {type:'nightstand',name:'Nightstand',width:1.67,depth:1.5,height:2,color:'#d7b58c',icon:'▧'},
  {type:'table',name:'Dining table',width:5,depth:3,height:2.5,color:'#d9b992',icon:'▱'},
  {type:'bookshelf',name:'Bookshelf',width:3,depth:1,height:6,color:'#c6ab8e',icon:'▥'},
]
export const freshLayout = (): Layout => ({version:1,room:{width:12,length:14},furniture:[]})
export const footprint = (f: Pick<Furniture,'width'|'depth'|'rotation'>) => f.rotation % 180 === 0 ? {w:f.width,d:f.depth} : {w:f.depth,d:f.width}
export function fitFurniture(f: Furniture, room: Layout['room']): Furniture {
  const swapped = f.rotation % 180 !== 0
  const next = {...f,width:Math.min(f.width,swapped?room.length:room.width),depth:Math.min(f.depth,swapped?room.width:room.length)}
  const {w,d}=footprint(next)
  return {...next,x:Math.max(w/2,Math.min(room.width-w/2,next.x)),z:Math.max(d/2,Math.min(room.length-d/2,next.z))}
}
export function resizeRoom(layout: Layout, room: Layout['room']): Layout {
  const error=openingError(layout.openings??[],room)
  if(error)throw Error(error)
  return {...layout,room,furniture:layout.furniture.map(f=>fitFurniture(f,room))}
}
export function addFurniture(layout: Layout,type: FurnitureType): Furniture {
  const item=CATALOG.find(c=>c.type===type)!
  return fitFurniture({id:crypto.randomUUID(),type,x:layout.room.width/2,y:0,z:layout.room.length/2,width:item.width,depth:item.depth,height:item.height,rotation:0,color:item.color},layout.room)
}
export function parseLayout(raw: string): Layout {
  const data=JSON.parse(raw)
  const finite=(n: unknown,min: number,max: number): n is number=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max
  if(data?.version!==1||!finite(data.room?.width,5,40)||!finite(data.room?.length,5,40)||!Array.isArray(data.furniture)||data.furniture.length>500) throw Error('Invalid layout')
  const ids=new Set<string>()
  for(const f of data.furniture){
    if(!f||typeof f.id!=='string'||ids.has(f.id)||!CATALOG.some(c=>c.type===f.type)||!finite(f.width,.5,40)||!finite(f.depth,.5,40)||!finite(f.height,.1,40)||!finite(f.x,0,40)||!finite(f.z,0,40)||f.y!==0||![0,90,180,270].includes(f.rotation)||typeof f.color!=='string'||!/^#[0-9a-f]{6}$/i.test(f.color)) throw Error('Invalid furniture')
    ids.add(f.id)
  }
  if(data.openings!==undefined&&(!Array.isArray(data.openings)||data.openings.length>100||openingError(data.openings,data.room)))throw Error('Invalid openings')
  if(data.appearance!==undefined){const a=data.appearance;if(!a||!/^#[0-9a-f]{6}$/i.test(a.wallColor)||!/^#[0-9a-f]{6}$/i.test(a.floorColor)||!['wood','tile','plain'].includes(a.floorMaterial))throw Error('Invalid appearance')}
  return resizeRoom(data,data.room)
}
