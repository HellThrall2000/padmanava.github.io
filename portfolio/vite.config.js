import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    open: false,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        projects: resolve(__dirname, 'projects.html'),
        hobbies: resolve(__dirname, 'hobbies.html'),
        notFound: resolve(__dirname, '404.html'),
      },
    },
  },
});