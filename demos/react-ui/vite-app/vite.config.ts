import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        legacy({
            targets: ['>0.3%', 'defaults'],
        }),
    ],
    define: {
        global: 'window',
    },
    build: {
        // Set false to speed up build process, should change to `true` for production mode.
        minify: false,
    },
    optimizeDeps: {
        // Clear the array to optimize the dependencies
        exclude: [
            '@tronweb3/tronwallet-adapters',
            '@tronweb3/tronwallet-adapter-tronlink',
            '@tronweb3/tronwallet-abstract-adapter',
        ],
    },
    server: {
        host: '0.0.0.0',
        port: 5003,
    },
});
