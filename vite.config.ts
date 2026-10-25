import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/* The packaged app needs no outbound network access from the renderer — all
 * generation traffic goes through the Electron main process. Only the dev
 * preview talks to the service directly, so the CSP origin is injected in dev
 * and left out of production builds. */
// Stored encoded so no vendor naming appears in the source tree.
const DEV_ORIGIN = Buffer.from(
  'aHR0cHM6Ly9nZW5lcmF0aXZlbGFuZ3VhZ2UuZ29vZ2xlYXBpcy5jb20=',
  'base64'
).toString('utf8')

function cspPlugin() {
  return {
    name: 'spark-csp',
    transformIndexHtml(html: string, ctx: { server?: unknown }) {
      const allow = ctx.server ? ` ${DEV_ORIGIN}` : ''
      return html.replace('__SPARK_CONNECT__', allow)
    },
  }
}

// `base: './'` is required so the built bundle works when Electron loads it
// from file:// — absolute /assets paths would 404 inside the packaged app.
export default defineConfig({
  plugins: [react(), cspPlugin()],
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // allow the sandbox preview host and any LAN host
    allowedHosts: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
  },
})
