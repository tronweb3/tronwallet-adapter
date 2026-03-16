import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'happy-dom',
    },
    ssr: {
        noExternal: ['@binance/w3w-utils', '@tronweb3/abstract-adapter-evm'],
    },
});
