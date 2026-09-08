import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      usePolling: true
    }
  },
  build: {
    // Preserve Vite 5's former "modules" compilation floor across the Vite 7 upgrade.
    // This does not polyfill browser APIs or replace testing on those browsers.
    target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'],
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false
  }
})
