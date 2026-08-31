import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // ponytail: Windows here resolves "localhost" to ::1 only by default,
  // so bind both stacks or 127.0.0.1 in the browser gets connection refused.
  server: { host: true },
})
