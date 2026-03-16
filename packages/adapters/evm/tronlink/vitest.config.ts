import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'happy-dom',
    },
    ssr: {
        noExternal: ['@tronweb3/abstract-adapter-evm'],
    },
});
