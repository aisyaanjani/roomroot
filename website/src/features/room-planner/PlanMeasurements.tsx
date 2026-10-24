import { Group, Line, Rect, Text } from './konva'
import type { Furniture } from './model'
import { footprint } from './model'
import { feet } from './measurements'
/** Screen-sized labels remain legible as the room scale changes. No hit targets. */
export function PlanMeasurements({item,scale}:{item:Furniture;scale:number}){
  const {w,d}=footprint(item),unit=1/scale
  return <Group listening={false}>
    <Line points={[item.x-w/2,item.z+d/2+10*unit,item.x+w/2,item.z+d/2+10*unit]} stroke="#3a6249" strokeWidth={unit}/>
    <Line points={[item.x-w/2,item.z+d/2+6*unit,item.x-w/2,item.z+d/2+14*unit]} stroke="#3a6249" strokeWidth={unit}/>
    <Line points={[item.x+w/2,item.z+d/2+6*unit,item.x+w/2,item.z+d/2+14*unit]} stroke="#3a6249" strokeWidth={unit}/>
    <Rect x={item.x-24*unit} y={item.z+d/2+3*unit} width={48*unit} height={16*unit} fill="#fffdf6" cornerRadius={4*unit}/>
    <Text x={item.x-24*unit} y={item.z+d/2+4*unit} width={48*unit} fontSize={11*unit} text={feet(w)} align="center" fill="#294b3b"/>
    <Rect x={item.x+w/2+4*unit} y={item.z-8*unit} width={48*unit} height={16*unit} fill="#fffdf6" cornerRadius={4*unit}/>
    <Text x={item.x+w/2+4*unit} y={item.z-6*unit} width={48*unit} fontSize={11*unit} text={feet(d)} align="center" fill="#294b3b"/>
  </Group>
}
