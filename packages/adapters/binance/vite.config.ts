import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'jsdom',
        deps: {
            inline: ['@my-org/ts-lib'],
        },
    },
});
