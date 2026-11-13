import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // O domínio próprio serve a aplicação diretamente na raiz.
  base: '/',
});
