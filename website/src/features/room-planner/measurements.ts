import { footprint } from './model.ts'
import type { Furniture, Layout } from './model.ts'
export function wallClearances(item:Furniture,room:Layout['room']){
  const {w,d}=footprint(item)
  return {north:Math.max(0,item.z-d/2),east:Math.max(0,room.width-item.x-w/2),south:Math.max(0,room.length-item.z-d/2),west:Math.max(0,item.x-w/2)}
}
export const feet=(value:number)=>`${Number(value.toFixed(2))} ft`
