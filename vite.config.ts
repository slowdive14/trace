import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/trace/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // 새 SW를 즉시 활성화하고 옛 캐시를 정리한다.
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,
        // vite-plugin-pwa 기본값(navigateFallback: 'index.html')이 주입하는 cache-first
        // navigation 라우트를 끈다. 이게 살아있으면 먼저 등록되어 아래 NetworkFirst를 무력화함.
        navigateFallback: undefined,
        // index.html은 precache에서 제외한다. precache 라우트가 먼저 등록되어 root('/trace/')를
        // directoryIndex 규칙으로 캐시된 index.html에 매칭시켜 가로채면 아래 NetworkFirst가
        // 무력화되기 때문. 해시된 JS/CSS는 그대로 precache(immutable → cache-first가 이상적).
        globIgnores: ['**/index.html'],
        // 페이지(HTML) 요청은 network-first: 온라인이면 항상 최신 index.html(=최신 JS 해시)을
        // 받아 stale 캐시로 옛 코드가 뜨는 문제를 막는다. 오프라인일 때만 캐시로 폴백.
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-pages',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 16 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'Serein',
        short_name: 'Serein',
        description: 'A minimal, elegant daily journaling app',
        theme_color: '#0d0d0d',
        background_color: '#0d0d0d',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
  },
})
