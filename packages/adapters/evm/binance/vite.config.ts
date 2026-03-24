import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        alias: {
            '@tronweb3/abstract-adapter-evm': fileURLToPath(new URL('../abstract-adapter/src/index.ts', import.meta.url)),
        },
    },
    test: {
        globals: true,
        environment: 'jsdom',
        deps: {
            inline: [],
        },
    },
});
