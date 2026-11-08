import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base harus sama dengan nama repo agar jalan di https://dubay9881-hue.github.io/catatku/
export default defineConfig({
  plugins: [react()],
  base: '/catatku/',
})
