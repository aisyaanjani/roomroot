import type { Furniture, Layout } from './model'
import { feet, wallClearances } from './measurements'
export function Measurements({item,room}:{item:Furniture;room:Layout['room']}){
  const clearances=wallClearances(item,room)
  return <section className="rs-measurements" aria-label="Selected furniture measurements"><div className="rs-dimension-summary"><span><small>WIDTH</small>{feet(item.width)}</span><span><small>DEPTH</small>{feet(item.depth)}</span><span><small>HEIGHT</small>{feet(item.height)}</span></div><h3 title="Shortest perpendicular distance from the rotated footprint to each wall">Wall clearances <span>↗</span></h3><dl>{Object.entries(clearances).map(([wall,value])=><div key={wall}><dt>{wall}</dt><dd>{feet(value)}</dd></div>)}</dl><p>From this piece’s edge. Other furniture and door swings aren’t included.</p></section>
}
