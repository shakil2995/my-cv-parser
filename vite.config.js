import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],

  server: {
    host: '192.168.100.119',
    port: 4300,
    strictPort: true,
  },

  preview: {
    host: '192.168.100.119',
    port: 4300,
    strictPort: true,
  },
})
