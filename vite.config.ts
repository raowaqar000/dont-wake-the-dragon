import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the build works inside the Capacitor WebView.
  base: './',
  server: {
    // Expose on the local network so the game can be tested on a phone over WiFi.
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
    chunkSizeWarningLimit: 2000, // Phaser alone is ~1.2 MB
  },
});
