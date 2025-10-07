// @ts-check
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'node:path'

export default defineConfig({
  plugins: [
    react(),
    visualizer({ filename: 'dist/stats.html', open: false, brotliSize: true })
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
    dedupe: ['@supabase/supabase-js'],
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    open: true
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          ui: ['prop-types', 'web-vitals']
        }
      }
    }
  }
})
