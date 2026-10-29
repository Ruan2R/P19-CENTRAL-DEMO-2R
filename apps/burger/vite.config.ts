import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5176,
    strictPort: true,
    // Mantém o navegador na mesma origem; o Vite encaminha /api para a API local.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3016',
        changeOrigin: false,
      },
    },
  },
})
