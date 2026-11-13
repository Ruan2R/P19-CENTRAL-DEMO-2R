import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Caminhos relativos permitem servir o mesmo build na raiz do domínio
  // próprio e no subdiretório do GitHub Pages.
  base: './',
});
