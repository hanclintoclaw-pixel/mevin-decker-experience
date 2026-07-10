import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/mevin-decker-experience/',
  define: {
    __SOURCE_COMMIT__: JSON.stringify(process.env.VITE_SOURCE_COMMIT ?? 'local-dev'),
  },
  plugins: [react()],
})
