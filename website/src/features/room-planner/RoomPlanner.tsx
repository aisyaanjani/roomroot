import { lazy, Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Stage, Layer, Group, Rect, Line, Text, Circle } from 'react-konva'
import { CATALOG, STORAGE_KEY, DEFAULT_APPEARANCE, collisions, openingError, addFurniture, fitFurniture, footprint, freshLayout, parseLayout, resizeRoom } from './model'
import type { Furniture, Layout } from './model'
import { RoomOptions } from './RoomOptions'
import { historyReducer, initialHistory } from './history'
import type { Dispatch, SetStateAction } from 'react'
import './RoomPlanner.css'

const RoomViewer3D = lazy(()=>import('./RoomViewer3D'))

function load() {
  try { const raw=localStorage.getItem(STORAGE_KEY); return {layout:raw?parseLayout(raw):freshLayout(),notice:''} }
  catch { return {layout:freshLayout(),notice:'Your saved layout could not be read. A fresh room is ready.'} }
}
function NumberField({label,value,min,max,onChange}:{label:string;value:number;min:number;max:number;onChange:(n:number)=>void|boolean}) {
  const [draft,setDraft]=useState(String(value))
  const [error,setError]=useState(false)
  const [previous,setPrevious]=useState(value)
  if(previous!==value){setPrevious(value);setDraft(String(value));setError(false)}
  function commit(){const n=Number(draft);if(!draft.trim()||!Number.isFinite(n)||n<min||n>max){setError(true);return}setError(false);if(onChange(n)===false)setDraft(String(value))}
  return <label className="rs-field">{label}<span className="rs-input"><input aria-label={label} aria-invalid={error} type="number" min={min} max={max} step="0.01" value={draft} onChange={e=>{setDraft(e.target.value);setError(false)}} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur()}}/><span>ft</span></span>{error&&<small role="alert">Enter {min}–{max} ft.</small>}</label>
}
export function RoomPlanner(){
  const [initial]=useState(load)
  const [history,dispatch]=useReducer(historyReducer,initial.layout,initialHistory)
  const layout=history.present
  const setLayout:Dispatch<SetStateAction<Layout>>=useCallback(value=>dispatch({type:'update',value}),[])
  const beginDrag=useCallback(()=>dispatch({type:'begin'}),[])
  const endDrag=useCallback(()=>dispatch({type:'end'}),[])
  const moveFurniture=useCallback((id:string,x:number,z:number)=>setLayout(l=>({...l,furniture:l.furniture.map(f=>f.id===id?fitFurniture({...f,x,z},l.room):f)})),[setLayout])
  const overlaps=useMemo(()=>collisions(layout.furniture),[layout.furniture])
  const appearance=layout.appearance??DEFAULT_APPEARANCE
  useEffect(()=>{function shortcut(e:KeyboardEvent){
    const target=e.target as HTMLElement|null
    if(target?.closest('input,textarea,select,[contenteditable="true"]'))return
    if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'&&!e.altKey){e.preventDefault();dispatch({type:e.shiftKey?'redo':'undo'})}
  }window.addEventListener('keydown',shortcut);return()=>window.removeEventListener('keydown',shortcut)},[])
  const [notice,setNotice]=useState(initial.notice)
  const [saveStatus,setSaveStatus]=useState('Saved on this device')
  const [selected,setSelected]=useState<string|null>(null)
  const [view,setView]=useState<'2d'|'3d'>('2d')
  const [zoom,setZoom]=useState(1)
  const [pan,setPan]=useState({x:0,y:0})
  const [panMode,setPanMode]=useState(false)
  const [size,setSize]=useState({width:640,height:640})
  const host=useRef<HTMLDivElement>(null)
  const dragStart=useRef<{x:number;y:number;px:number;py:number}|null>(null)
  const item=layout.furniture.find(f=>f.id===selected)
  useEffect(()=>{const observer=new ResizeObserver(([e])=>setSize({width:e.contentRect.width,height:e.contentRect.height}));if(host.current)observer.observe(host.current);return()=>observer.disconnect()},[view])
  useEffect(()=>{const timer=window.setTimeout(()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(layout));setSaveStatus('Saved on this device')}catch{setSaveStatus('Unable to save on this device')}},100);return()=>window.clearTimeout(timer)},[layout])
  const scale=Math.max(1,Math.min((size.width-104)/layout.room.width,(size.height-112)/layout.room.length))*zoom
  const origin={x:(size.width-layout.room.width*scale)/2+pan.x,y:(size.height-layout.room.length*scale)/2+pan.y}
  const name=(f:Furniture)=>CATALOG.find(c=>c.type===f.type)!.name
  function patch(values:Partial<Furniture>){if(!item)return;setLayout(l=>({...l,furniture:l.furniture.map(f=>f.id===item.id?fitFurniture({...f,...values},l.room):f)}))}
  function roomChange(room:Layout['room']){const issue=openingError(layout.openings??[],room);if(issue){setNotice('Room not resized: '+issue);return false}setLayout(l=>resizeRoom(l,room));setZoom(1);setPan({x:0,y:0});setNotice('Room updated. Items were kept inside; oversized furniture was reduced to fit.');return true}
  function fit(){setZoom(1);setPan({x:0,y:0})}
  return <div className="rootspace">
    <header className="rs-header"><div><div className="rs-brand">ROOMROOT <span> / YOUR SPACE, REIMAGINED</span></div><h1>RootSpace<span>Make room for your life.</span></h1></div><div className="rs-tabs" aria-label="Planner views"><button className={view==='2d'?'active':''} aria-pressed={view==='2d'} onClick={()=>setView('2d')}>▦ 2D planner</button><button className={view==='3d'?'active':''} aria-pressed={view==='3d'} onClick={()=>setView('3d')}>◇ 3D room</button></div></header>
    <div className="rs-status"><span><i/> {saveStatus}</span><span>PLAN · PLACE · MAKE IT YOURS</span></div>
    {notice&&<div className="rs-notice" role="status">{notice}<button aria-label="Dismiss notice" onClick={()=>setNotice('')}>×</button></div>}
    <div className="rs-history"><button title="Undo (Cmd/Ctrl+Z)" disabled={!history.past.length||!!history.transaction} onClick={()=>dispatch({type:'undo'})}>↶ Undo</button><button title="Redo (Cmd/Ctrl+Shift+Z)" disabled={!history.future.length||!!history.transaction} onClick={()=>dispatch({type:'redo'})}>↷ Redo</button>{overlaps.size>0&&<span role="status" className="rs-collision-warning">{overlaps.size} pieces overlap · amber outlines show where</span>}</div>
    <main className="rs-layout">
      <aside className="rs-panel rs-library"><div className="rs-section"><div className="rs-eyebrow">01 / THE FOUNDATION</div><h2>Your room</h2><p>A little space. A lot of possibility.</p><div className="rs-fields"><NumberField label="Room width" value={layout.room.width} min={5} max={40} onChange={width=>roomChange({...layout.room,width})}/><NumberField label="Room length" value={layout.room.length} min={5} max={40} onChange={length=>roomChange({...layout.room,length})}/></div><div className="rs-area">{(layout.room.width*layout.room.length).toFixed(1)} <span>sq ft to make your own</span></div></div>
      <RoomOptions layout={layout} onChange={setLayout}/>
      <div className="rs-section"><div className="rs-eyebrow">02 / THE POSSIBILITIES</div><h2>Furniture library</h2><p>Click a piece to bring it in.</p><div className="rs-catalog">{CATALOG.map(c=><button key={c.type} onClick={()=>{const f=addFurniture(layout,c.type);setLayout(l=>({...l,furniture:[...l.furniture,f]}));setSelected(f.id);if(f.width!==c.width||f.depth!==c.depth)setNotice('This piece was reduced to fit your room.')}}><span className="rs-furniture-icon" style={{background:c.color+'55'}}>{c.icon}</span><strong>{c.name}</strong><small>{c.width} × {c.depth} ft</small><span className="rs-add">+</span></button>)}</div></div>
      <button className="rs-reset" onClick={()=>{if(window.confirm('Reset your room? This removes furniture, doors, windows and custom finishes, and restores a 12 × 14 ft room.')){setLayout(freshLayout());setSelected(null);setNotice('Room reset. A fresh start.');fit()}}}>Reset Room</button></aside>
      <section className="rs-workspace" aria-label={view==='2d'?'2D floor planner':'3D room viewer'}><div className="rs-canvas-top"><div><strong>{view==='2d'?'Your floor plan':'Your room, in perspective'}</strong><span>{layout.room.width} × {layout.room.length} ft · {layout.furniture.length} pieces</span></div><span className="rs-pill">{view==='2d'?'TOP VIEW':'3D VIEW'}</span></div>
      {view==='3d'?<Suspense fallback={<div className="rs-viewer-3d rs-3d-loading" role="status">Opening your room…</div>}><RoomViewer3D layout={layout} selected={selected} onSelect={setSelected} onMove={moveFurniture} onDragStart={beginDrag} onDragEnd={endDrag}/></Suspense>:<div className={'rs-canvas '+(panMode?'panning':'')} ref={host}>
      <Stage width={size.width} height={size.height} onWheel={e=>{e.evt.preventDefault();const pointer=e.target.getStage()!.getPointerPosition()!;const next=Math.max(.4,Math.min(3,zoom*(e.evt.deltaY>0?.9:1.1)));const ratio=next/zoom;setPan({x:(pointer.x-size.width/2)*(1-ratio)+pan.x*ratio,y:(pointer.y-size.height/2)*(1-ratio)+pan.y*ratio});setZoom(next)}} onMouseDown={e=>{if(panMode||e.evt.button===1){dragStart.current={x:e.evt.clientX,y:e.evt.clientY,px:pan.x,py:pan.y}}else if(e.target===e.target.getStage()||e.target.name()==='floor')setSelected(null)}} onMouseMove={e=>{const d=dragStart.current;if(d)setPan({x:d.px+e.evt.clientX-d.x,y:d.py+e.evt.clientY-d.y})}} onMouseUp={()=>{dragStart.current=null}} onMouseLeave={()=>{dragStart.current=null}} onTouchStart={e=>{if(panMode&&e.evt.touches.length===1){const t=e.evt.touches[0];dragStart.current={x:t.clientX,y:t.clientY,px:pan.x,py:pan.y}}else if(e.target.name()==='floor'||e.target===e.target.getStage())setSelected(null)}} onTouchMove={e=>{const d=dragStart.current;const t=e.evt.touches[0];if(d&&t){e.evt.preventDefault();setPan({x:d.px+t.clientX-d.x,y:d.py+t.clientY-d.y})}}} onTouchEnd={()=>{dragStart.current=null}}>
      <Layer><Group x={origin.x} y={origin.y} scaleX={scale} scaleY={scale}>
        <Rect name="floor" width={layout.room.width} height={layout.room.length} fill={appearance.floorColor} stroke={appearance.wallColor} strokeWidth={.22} shadowColor="#354b3a" shadowBlur={18} shadowOpacity={.12}/>
        {Array.from({length:Math.ceil(layout.room.width)-1},(_,i)=><Line key={'x'+i} points={[i+1,0,i+1,layout.room.length]} stroke="#d9ddd1" strokeWidth={.016} listening={false}/>)}
        {Array.from({length:Math.ceil(layout.room.length)-1},(_,i)=><Line key={'z'+i} points={[0,i+1,layout.room.width,i+1]} stroke="#d9ddd1" strokeWidth={.016} listening={false}/>)}
        <Text x={0} y={-28/scale} width={layout.room.width} text={`${layout.room.width} ft`} fontSize={13/scale} fill="#385543" align="center" listening={false}/>
        <Text x={-36/scale} y={layout.room.length/2} text={`${layout.room.length} ft`} rotation={-90} fontSize={13/scale} fill="#385543" listening={false}/>
        {appearance.floorMaterial==='wood'&&Array.from({length:Math.ceil(layout.room.width/.65)-1},(_,i)=><Line key={'plank'+i} points={[(i+1)*.65,0,(i+1)*.65,layout.room.length]} stroke="#ffffff33" strokeWidth={.025} listening={false}/>)}
        {appearance.floorMaterial==='tile'&&<>{Array.from({length:Math.ceil(layout.room.width/2)-1},(_,i)=><Line key={'tilex'+i} points={[(i+1)*2,0,(i+1)*2,layout.room.length]} stroke="#aaa797" strokeWidth={.025} listening={false}/>)}{Array.from({length:Math.ceil(layout.room.length/2)-1},(_,i)=><Line key={'tilez'+i} points={[0,(i+1)*2,layout.room.width,(i+1)*2]} stroke="#aaa797" strokeWidth={.025} listening={false}/>)}</>}
        {(layout.openings??[]).map(o=>{const vertical=o.wall==='east'||o.wall==='west';return <Group key={o.id} name={'opening:'+o.id} x={vertical?(o.wall==='east'?layout.room.width:0):o.position} y={vertical?o.position:(o.wall==='south'?layout.room.length:0)} rotation={vertical?90:0} listening={false}>
          <Rect y={-.12} width={o.width} height={.24} fill={o.type==='door'?'#bba382':'#bed9dc'} stroke={o.type==='door'?'#8b7354':'#648c90'} strokeWidth={.035}/>
          {o.type==='door'?<Line points={[0,0,0,o.wall==='south'||o.wall==='west'?-o.width:o.width]} stroke="#8b7354" strokeWidth={.04} dash={[.12,.08]}/>:<Line points={[o.width/2,-.12,o.width/2,.12]} stroke="#648c90" strokeWidth={.04}/>}
          <Text y={-.55} width={o.width} fontSize={.25} text={o.type==='door'?'Door':'Window'} align="center" fill="#486853"/>
        </Group>})}
        {layout.furniture.map(f=><Group key={f.id} name={f.id} x={f.x} y={f.z} rotation={f.rotation} draggable={!panMode} onClick={()=>setSelected(f.id)} onTap={()=>setSelected(f.id)} onDragStart={()=>{setSelected(f.id);beginDrag()}} onDragMove={e=>moveFurniture(f.id,e.target.x(),e.target.y())} dragBoundFunc={pos=>{const {w,d}=footprint(f);return {x:Math.max(origin.x+w*scale/2,Math.min(origin.x+(layout.room.width-w/2)*scale,pos.x)),y:Math.max(origin.y+d*scale/2,Math.min(origin.y+(layout.room.length-d/2)*scale,pos.y))}}} onDragEnd={e=>{const node=e.target;setLayout(l=>({...l,furniture:l.furniture.map(v=>v.id===f.id?fitFurniture({...v,x:node.x(),z:node.y()},l.room):v)}));endDrag()}}>
          <Rect x={-f.width/2} y={-f.depth/2} width={f.width} height={f.depth} fill={f.color} stroke={overlaps.has(f.id)?'#bd804e':selected===f.id?'#22543b':'#64745e'} strokeWidth={selected===f.id||overlaps.has(f.id)?3/scale:1/scale} cornerRadius={.1} shadowBlur={selected===f.id?8:3} shadowOpacity={.14}/>
          {['twin','full','queen'].includes(f.type)&&<><Rect x={-f.width/2+.15} y={-f.depth/2+.2} width={f.width-.3} height={1.05} fill="#f8f5e9" cornerRadius={.14} listening={false}/><Line points={[-f.width/2+.1,-f.depth/2+1.5,f.width/2-.1,-f.depth/2+1.5]} stroke="#ffffff99" strokeWidth={.06} listening={false}/></>}
          {f.type==='chair'&&<Circle radius={f.width*.33} fill="#ffffff44" listening={false}/>}
          <Text x={-f.width/2+.1} y={-.18} width={f.width-.2} text={name(f)} align="center" fontSize={Math.min(.33,f.width/8)} fill="#263f32" listening={false}/>
        </Group>)}
      </Group></Layer></Stage>
      {layout.furniture.length===0&&<div className="rs-empty"><span>↖</span><strong>Every great room starts somewhere.</strong><p>Add your first piece from the library.</p></div>}
      <div className="rs-toolbar"><button aria-label="Zoom out" onClick={()=>setZoom(z=>Math.max(.4,z-.1))}>−</button><span>{Math.round(zoom*100)}%</span><button aria-label="Zoom in" onClick={()=>setZoom(z=>Math.min(3,z+.1))}>+</button><button onClick={fit}>Fit room</button><button aria-pressed={panMode} onClick={()=>setPanMode(v=>!v)}>{panMode?'✓ Pan':'✥ Pan'}</button></div>
      </div>}<div className="rs-canvas-footer"><span>{view==='2d'?'▦ 1 square = 1 ft':'Cutaway walls · All dimensions in feet'}</span><span>{view==='2d'?'Scroll to zoom · Pan mode to move the view':'Drag a piece to move · Empty space to orbit · Scroll / pinch to zoom · Right-drag / two fingers to pan'}</span></div></section>
      <aside className="rs-panel rs-properties"><div className="rs-section"><div className="rs-eyebrow">03 / THE DETAILS</div><h2>Make it yours</h2>{item?<><p>{name(item)} · Selected piece</p>{overlaps.has(item.id)&&<p className="rs-error">This piece overlaps another. Drag it to make room.</p>}<div className="rs-selection-swatch" style={{background:item.color}}>{CATALOG.find(c=>c.type===item.type)!.icon}</div><div className="rs-fields"><NumberField key={item.id+'w'} label="Furniture width" value={item.width} min={.5} max={item.rotation%180?layout.room.length:layout.room.width} onChange={width=>patch({width})}/><NumberField key={item.id+'d'} label="Furniture depth" value={item.depth} min={.5} max={item.rotation%180?layout.room.width:layout.room.length} onChange={depth=>patch({depth})}/></div><NumberField key={item.id+'h'} label="Furniture height" value={item.height} min={.1} max={40} onChange={height=>patch({height})}/><label className="rs-color">Color <input aria-label="Furniture color" type="color" value={item.color} onChange={e=>patch({color:e.target.value})}/><span>{item.color}</span></label><div className="rs-position">Position: x {item.x.toFixed(2)} · z {item.z.toFixed(2)} ft<br/>{item.width} × {item.depth} × {item.height} ft · {item.rotation}°</div><button className="rs-action" onClick={()=>{const rotation=(item.rotation+90)%360;const {w,d}=footprint({...item,rotation});if(w>layout.room.width||d>layout.room.length){setNotice('This piece is too large to rotate here. Reduce its width or depth first.');return}patch({rotation})}}>↻ Rotate 90°</button><button className="rs-action" onClick={()=>{const copy=fitFurniture({...item,id:crypto.randomUUID(),x:item.x+.5,z:item.z+.5},layout.room);setLayout(l=>({...l,furniture:[...l.furniture,copy]}));setSelected(copy.id)}}>⧉ Duplicate piece</button><button className="rs-delete" onClick={()=>{setLayout(l=>({...l,furniture:l.furniture.filter(f=>f.id!==item.id)}));setSelected(null)}}>Delete piece</button></>:<div className="rs-no-selection"><span>⌖</span><h3>A place for every detail.</h3><p>Select a piece on the plan to adjust its size, color and direction.</p></div>}</div><div className="rs-tip"><strong>A little planning goes a long way.</strong><p>Leave about 3 ft of space along your main walkways for an easy flow.</p></div>{layout.furniture.length>0&&<div className="rs-section rs-piece-list"><h3>In your room</h3>{layout.furniture.map((f,i)=><button aria-pressed={f.id===selected} key={f.id} onClick={()=>setSelected(f.id)}>{name(f)} <span>{i+1}</span></button>)}</div>}</aside>
    </main><footer className="rs-footer">ROOTSPACE BY ROOMROOT <span>A room that feels like you.</span></footer>
  </div>
}
