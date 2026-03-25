import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'happy-dom',
    },
    ssr: {
        noExternal: [
            '@binance/w3w-utils',
            '@tronweb3/tronwallet-abstract-adapter',
            '@tronweb3/tronwallet-adapter-tronlink',
            '@tronweb3/tronwallet-adapter-walletconnect',
        ],
    },
});
