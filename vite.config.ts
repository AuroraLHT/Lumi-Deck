import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
  },
  define: {
    // react-draggable (pulled in by react-grid-layout) calls a debug helper that
    // reads `process.env.DRAGGABLE_DEBUG` on every drag start. `process` does not
    // exist in the browser, so without this shim the ReferenceError is thrown
    // inside onMouseDown and panels silently refuse to drag. Vite only replaces
    // `process.env.NODE_ENV` on its own, so the rest of `process.env` needs to be
    // defined explicitly.
    'process.env': {},
  },
})
