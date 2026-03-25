import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'happy-dom',
        include: ['tests/**/*.test.{ts,tsx}'],
        deps: {
            optimizer: {
                web: {
                    include: ['@tronweb3/tronwallet-abstract-adapter'],
                },
            },
        },
    },
});
