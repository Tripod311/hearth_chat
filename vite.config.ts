import { defineConfig } from 'vite'
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  root: 'client',
  publicDir: '../public',
  plugins: [tailwindcss()],
  build: {
    outDir: '../client_dist',
    emptyOutDir: true
  }
})