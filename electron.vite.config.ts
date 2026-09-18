import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'
import { resolve } from 'path'
import { createManualChunks } from './src/manual-chunks'

export default defineConfig({
  main: {
    build: {
      minify: 'terser',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/main/bootstrap.ts'),
        },
      },
      externalizeDeps: {
        exclude: [
          '@electron-toolkit/utils',
          'electron-store',
          'electron-dl',
          'electron-updater',
          'discord-rpc',
          'i18next',
        ],
      },
    },
  },
  preload: {
    build: {
      minify: 'terser',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/preload/index.ts'),
        },
      },
      externalizeDeps: {
        exclude: ['@electron-toolkit/preload', 'electron-updater'],
      },
    },
  },
  renderer: {
    root: '.',
    plugins: [react()],
    server: {
      // The Electron development shell uses file:// so it can share the
      // installed app's origin-scoped storage.
      cors: true,
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
    build: {
      minify: 'terser',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'index.html'),
        },
        output: {
          manualChunks: createManualChunks,
        },
      },
    },
  },
})
