import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { expressPlugin } from './vite-express-plugin'

export default defineConfig({
  plugins: [react(), expressPlugin()],
  test: {
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    globals: true,
  },
})
