import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Repo bernama ubayd12.github.io, jadi aplikasi ada di akar domain: https://ubayd12.github.io/
export default defineConfig({
  plugins: [react()],
  base: '/',
})
