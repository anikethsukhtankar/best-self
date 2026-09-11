import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Builds the visual harness pages under tests/visual into dist-visual (see npm run visual).
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist-visual', emptyOutDir: true, rollupOptions: { input: 'tests/visual/insights.html' } },
})
