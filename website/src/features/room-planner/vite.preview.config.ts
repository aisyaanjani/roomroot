import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const bundleReport:Plugin={
  name:'rootspace-bundle-report',
  generateBundle(_options,bundle){
    if(!process.env.ROOTSPACE_ANALYZE)return
    for(const chunk of Object.values(bundle))if(chunk.type==='chunk'){
      const largest=Object.entries(chunk.modules).sort((a,b)=>b[1].renderedLength-a[1].renderedLength).slice(0,6)
      console.info(`[RootSpace analysis] ${chunk.fileName}: ${Math.round(chunk.code.length/1024)} KiB minified`)
      for(const [name,module] of largest)console.info(`  ${Math.round(module.renderedLength/1024)} KiB rendered: ${name.split('/node_modules/').pop()}`)
    }
  },
}

// A separate build entry keeps the shared application and its config untouched.
export default defineConfig({
  root: fileURLToPath(new URL('../../../', import.meta.url)),
  plugins: [react(),bundleReport],
  build: {
    outDir: 'dist/rootspace',
    rollupOptions: { input: fileURLToPath(new URL('./preview.html', import.meta.url)) },
  },
})
