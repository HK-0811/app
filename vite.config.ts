import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { expressPlugin } from './vite-express-plugin'

export default defineConfig({
  plugins: [react(), expressPlugin()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    globals: true,
  },
})
