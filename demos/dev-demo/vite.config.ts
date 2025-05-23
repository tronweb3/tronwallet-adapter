import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        nodePolyfills({
            // include: ['crypto', 'buffer', 'stream'],
            globals: {
                Buffer: true,
            },
        }),
        react(),
    ],
    server: {
        host: '0.0.0.0',
        port: 3003,
    },
    build: {
        minify: false,
        rollupOptions: {
            // external: ['buffer']
        }
    },
});
