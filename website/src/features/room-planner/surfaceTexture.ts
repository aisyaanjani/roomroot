import { DataTexture, RepeatWrapping, RGBAFormat, SRGBColorSpace } from 'three'
/** Small deterministic, local surface maps; color comes from the saved material tint. */
export function surfaceTexture(kind:'wood'|'tile'){
  const size=64,data=new Uint8Array(size*size*4)
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const noise=((x*73+y*37+x*y*13)%19)/19
    const grain=Math.sin(x*.8+Math.sin(y*.15)*.8)*.035+noise*.025
    const value=kind==='wood'?Math.round(244+grain*90):(x<2||y<2?192:Math.round(247+noise*7))
    const at=(y*size+x)*4;data[at]=value;data[at+1]=value;data[at+2]=value;data[at+3]=255
  }
  const texture=new DataTexture(data,size,size,RGBAFormat)
  texture.wrapS=texture.wrapT=RepeatWrapping;texture.colorSpace=SRGBColorSpace;texture.needsUpdate=true
  return texture
}
