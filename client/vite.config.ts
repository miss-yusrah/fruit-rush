import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      workbox: {
        // Hashed Vite assets under /assets/ — cache aggressively; filename change = bust.
        globPatterns: ['**/*.{js,css,html,ico,svg,webp,json,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'fruit-rush-images',
              expiration: {
                maxEntries: 64,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'fruit-rush-fonts',
              expiration: {
                maxEntries: 8,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
      manifest: {
        name: 'Fruit Rush',
        short_name: 'Fruit Rush',
        description: 'Slice. Score. Own it on Celo.',
        theme_color: '#0B1F17',
        background_color: '#0B1F17',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  build: {
    // Keep small PNGs/WebPs as files with content hashes (not inlined as base64).
    assetsInlineLimit: 4096,
    // Don't modulepreload heavy async chunks — loading UI must paint first.
    modulePreload: {
      resolveDependencies(_filename, deps) {
        return deps.filter(
          (dep) =>
            !dep.includes('wallet') &&
            !dep.includes('pixi') &&
            !dep.includes('LiveWallet') &&
            !dep.includes('PlayScreen') &&
            !dep.includes('audio-'),
        )
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/pixi.js') || id.includes('node_modules/@pixi/')) {
            return 'pixi'
          }
          if (
            id.includes('node_modules/wagmi') ||
            id.includes('node_modules/viem') ||
            id.includes('node_modules/@wagmi') ||
            id.includes('node_modules/@tanstack/react-query')
          ) {
            return 'wallet'
          }
          if (id.includes('node_modules/framer-motion')) {
            return 'motion'
          }
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
})
