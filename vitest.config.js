import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-utils/test-setup.js'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/Pages/Admin/Commandes/**/*.{js,jsx}',
        'src/Pages/Admin/Commandes/components/CommandeCard.jsx',
        'src/Pages/Admin/Commandes/hooks/useCommandesData.js',
        'src/Pages/Admin/Commandes/utils/*.js'
      ],
      exclude: [
        '**/*.test.{js,jsx}',
        '**/*.spec.{js,jsx}',
        '**/node_modules/**',
        '**/test-utils/**'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
