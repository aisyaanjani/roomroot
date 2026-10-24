/** Fit room-envelope corners in perspective, then center their screen-space bounds.
 * The viewport margins reserve space for the toolbar and editor overlays.
 */
export function cameraFit(width:number,length:number,height:number,aspect:number,fov=45){
  const magnitude=Math.hypot(1,.9,1)
  const direction:[number,number,number]=[1/magnitude,.9/magnitude,1/magnitude]
  const right=[Math.SQRT1_2,0,-Math.SQRT1_2]
  const up=[-direction[1]*Math.SQRT1_2,direction[0]*Math.SQRT2,-direction[1]*Math.SQRT1_2]
  const center:[number,number,number]=[width/2,height/2,length/2]
  const tanV=Math.tan(fov*Math.PI/360)*.82,tanH=Math.tan(fov*Math.PI/360)*Math.max(.1,aspect)*.88
  const corners=[]
  for(const x of [-.25,width+.25])for(const y of [-.25,height+.25])for(const z of [-.25,length+.25]){
    const v=[x-center[0],y-center[1],z-center[2]]
    const dot=(basis:number[])=>v.reduce((sum,n,i)=>sum+n*basis[i]!,0)
    corners.push({x:dot(right),y:dot(up),z:dot(direction)})
  }
  let distance=Math.max(...corners.map(p=>p.z+Math.abs(p.x)/tanH))
  for(const a of corners)for(const b of corners)distance=Math.max(distance,(a.y-b.y)/(2*tanV)+(a.z+b.z)/2)
  const low=Math.max(...corners.map(p=>p.y-tanV*(distance-p.z)))
  const high=Math.min(...corners.map(p=>p.y+tanV*(distance-p.z)))
  // Keep OrbitControls' target within the room, even for unusually tall furniture.
  let minShift=-Infinity,maxShift=Infinity
  for(let i=0;i<3;i++){
    const a=-center[i]!/up[i]!,b=([width,height,length][i]!-center[i]!)/up[i]!
    minShift=Math.max(minShift,Math.min(a,b));maxShift=Math.min(maxShift,Math.max(a,b))
  }
  const shift=Math.max(minShift,Math.min(maxShift,(low+high)/2))
  distance=Math.max(distance,...corners.map(p=>p.z+Math.abs(p.y-shift)/tanV))
  const target=center.map((n,i)=>n+up[i]!*shift) as [number,number,number]
  return {target,distance,position:target.map((n,i)=>n+direction[i]!*distance) as [number,number,number]}
}
