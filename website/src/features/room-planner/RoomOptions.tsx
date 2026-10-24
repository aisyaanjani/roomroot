import { useState } from 'react'
import { DEFAULT_APPEARANCE, openingError, wallLength } from './model'
import type { Layout, Opening, Wall } from './model'
import type { Dispatch, SetStateAction } from 'react'

export function RoomOptions({layout,onChange}:{layout:Layout;onChange:Dispatch<SetStateAction<Layout>>}){
  const appearance=layout.appearance??DEFAULT_APPEARANCE
  const [wall,setWall]=useState<Wall>('north')
  const [type,setType]=useState<'door'|'window'>('door')
  const [position,setPosition]=useState('1')
  const [width,setWidth]=useState('3')
  const [height,setHeight]=useState('7')
  const [sill,setSill]=useState('0')
  const [editing,setEditing]=useState<string|null>(null)
  const [error,setError]=useState('')
  function submit(){
    const candidate:Opening={id:editing??crypto.randomUUID(),type,wall,position:position.trim()?Number(position):NaN,width:width.trim()?Number(width):NaN,height:height.trim()?Number(height):NaN,sill:type==='door'?0:sill.trim()?Number(sill):NaN}
    const openings=editing?(layout.openings??[]).map(o=>o.id===editing?candidate:o):[...(layout.openings??[]),candidate]
    const issue=openingError(openings,layout.room)
    if(issue){setError(issue);return}
    onChange(l=>({...l,openings}));setError('');setEditing(null)
  }
  const field=(label:string,value:string,set:Dispatch<SetStateAction<string>>,min:number,max:number)=><label className="rs-field">{label}<input aria-label={label} type="number" min={min} max={max} step="0.1" value={value} onChange={e=>set(e.target.value)}/></label>
  return <div className="rs-room-options">
    <details><summary>Room finishes</summary><div className="rs-options-body">
      <label className="rs-color">Wall color<input aria-label="Wall color" type="color" value={appearance.wallColor} onChange={e=>onChange(l=>({...l,appearance:{...(l.appearance??DEFAULT_APPEARANCE),wallColor:e.target.value}}))}/></label>
      <label className="rs-color">Floor color<input aria-label="Floor color" type="color" value={appearance.floorColor} onChange={e=>onChange(l=>({...l,appearance:{...(l.appearance??DEFAULT_APPEARANCE),floorColor:e.target.value}}))}/></label>
      <label className="rs-field">Floor material<select aria-label="Floor material" value={appearance.floorMaterial} onChange={e=>onChange(l=>({...l,appearance:{...(l.appearance??DEFAULT_APPEARANCE),floorMaterial:e.target.value as typeof appearance.floorMaterial}}))}><option value="wood">Wood</option><option value="tile">Tile</option><option value="plain">Neutral solid</option></select></label>
    </div></details>
    <details><summary>Doors & windows ({layout.openings?.length??0})</summary><div className="rs-options-body"><p>North is the top of the 2D plan. Position is measured from the west end of N/S walls, or the north end of E/W walls.</p>
      <label className="rs-field">Opening type<select aria-label="Opening type" value={type} onChange={e=>{const next=e.target.value as typeof type;setType(next);setHeight(next==='door'?'7':'4');setSill(next==='door'?'0':'3')}}><option value="door">Door</option><option value="window">Window</option></select></label>
      <label className="rs-field">Wall<select aria-label="Opening wall" value={wall} onChange={e=>setWall(e.target.value as Wall)}>{(['north','south','east','west'] as const).map(w=><option key={w} value={w}>{w[0]!.toUpperCase()+w.slice(1)}</option>)}</select></label>
      <div className="rs-fields">{field('Opening position (ft)',position,setPosition,0,wallLength(wall,layout.room))}{field('Opening width (ft)',width,setWidth,1,wallLength(wall,layout.room))}{field('Opening height (ft)',height,setHeight,1,8)}{type==='window'&&field('Window sill (ft)',sill,setSill,0,7)}</div>
      {error&&<p className="rs-error" role="alert">{error}</p>}<button className="rs-action" onClick={submit}>{editing?'Save opening':'Add opening'}</button>{editing&&<button className="rs-action" onClick={()=>{setEditing(null);setError('')}}>Cancel editing</button>}
      {(layout.openings??[]).map(o=><div key={o.id} className="rs-opening-row"><button title="Edit opening" onClick={()=>{setEditing(o.id);setType(o.type);setWall(o.wall);setPosition(String(o.position));setWidth(String(o.width));setHeight(String(o.height));setSill(String(o.sill));setError('')}}>{o.type==='door'?'Door':'Window'} · {o.wall} · {o.position} ft</button><button aria-label={`Delete ${o.type} on ${o.wall}`} title="Delete opening" onClick={()=>{onChange(l=>({...l,openings:l.openings?.filter(v=>v.id!==o.id)}));if(editing===o.id)setEditing(null)}}>×</button></div>)}
    </div></details>
  </div>
}
