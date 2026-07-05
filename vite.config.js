import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from 'tailwindcss';
export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['icon.svg', 'pwa-192x192.png', 'pwa-512x512.png', 'apple-touch-icon.png', 'offline.html'],
            manifest: {
                name: 'SplitNest',
                short_name: 'SplitNest',
                description: 'Shared expense splitting for roommates and small groups.',
                theme_color: '#3f3f3e',
                background_color: '#3f3f3e',
                display: 'standalone',
                display_override: ['standalone', 'minimal-ui'],
                scope: '/',
                start_url: '/',
                orientation: 'portrait-primary',
                categories: ['finance', 'productivity'],
                icons: [
                    { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
                    { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
                    { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
                    { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
                ]
            },
            devOptions: {
                enabled: true,
                type: 'module'
            },
            workbox: {
                navigateFallback: '/offline.html',
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
                        handler: 'NetworkFirst',
                        options: { cacheName: 'splitnest-supabase', networkTimeoutSeconds: 4 }
                    }
                ]
            }
        })
    ],
    server: {
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true
            }
        }
    }
});
