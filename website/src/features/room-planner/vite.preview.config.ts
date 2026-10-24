import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// A separate build entry keeps the shared application and its config untouched.
export default defineConfig({
  root: fileURLToPath(new URL('../../../', import.meta.url)),
  plugins: [react()],
  build: {
    outDir: 'dist/rootspace',
    rollupOptions: { input: fileURLToPath(new URL('./preview.html', import.meta.url)) },
  },
})
