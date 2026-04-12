import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [
    TanStackRouterVite({ routesDirectory: './src/app/routes' }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/ws-binance': {
        target: 'wss://stream.binance.com:9443',
        ws: true,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/ws-binance/, '/ws'),
      },
      '/ws-binance-alt': {
        target: 'wss://data-stream.binance.vision',
        ws: true,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/ws-binance-alt/, '/ws'),
      },
      '/api-binance': {
        target: 'https://api.binance.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api-binance/, ''),
      },
    },
  },
})
