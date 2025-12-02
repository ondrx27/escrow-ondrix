import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'crypto', 'util', 'stream', 'assert']
    })
  ],
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      '@safe-globalThis/safe-apps-sdk': '@safe-global/safe-apps-sdk',
      '@safe-globalThis/safe-apps-provider': '@safe-global/safe-apps-provider'
    }
  },
  server: {
    host: true,
    port: 3000
  },
  build: {
    rollupOptions: {
      external: [
        '@safe-globalThis/safe-apps-sdk',
        '@safe-globalThis/safe-apps-provider', 
        '@safe-globalThis/safe-gateway-typescript-sdk'
      ],
    },
  },
})