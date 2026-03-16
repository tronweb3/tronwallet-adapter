import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'happy-dom',
        setupFiles: ['./tests/setup.ts'],
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
