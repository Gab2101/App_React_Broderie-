// @ts-check
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
    dedupe: ['@supabase/supabase-js'],
  },
  server: {
    port: 3000,
    open: true
  },
  build: { sourcemap: true }
})
