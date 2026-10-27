import { defineConfig } from 'vitest/config';

/**
 * Root vitest config for the whole monorepo. Per-package settings (happy-dom,
 * react plugin, noExternal, etc.) live in each package's own vitest.config.ts
 * and are pulled in via `test.projects`. Coverage is configured centrally so a
 * single `pnpm test:coverage` aggregates results from every package.
 */
export default defineConfig({
    test: {
        projects: [
            'packages/adapters/abstract-adapter',
            'packages/adapters/adapters',
            'packages/adapters/backpack',
            'packages/adapters/binance',
            'packages/adapters/bitkeep',
            'packages/adapters/bybit',
            'packages/adapters/evm/abstract-adapter',
            'packages/adapters/evm/binance',
            'packages/adapters/evm/ledger',
            'packages/adapters/evm/metamask',
            'packages/adapters/evm/okxwallet',
            'packages/adapters/evm/tokenpocket',
            'packages/adapters/evm/tronlink',
            'packages/adapters/evm/trust',
            'packages/adapters/foxwallet',
            'packages/adapters/gatewallet',
            'packages/adapters/guarda',
            'packages/adapters/imtoken',
            'packages/adapters/ledger',
            'packages/adapters/metamask-tron',
            'packages/adapters/okxwallet',
            'packages/adapters/onekey',
            'packages/adapters/safepal',
            'packages/adapters/tokenpocket',
            'packages/adapters/tronlink',
            'packages/adapters/trust',
            'packages/adapters/walletconnect',
            'packages/react/react-hooks',
            'packages/react/react-ui',
            'packages/vue/vue-hooks',
            'packages/vue/vue-ui',
        ],
        coverage: {
            provider: 'v8',
            reportOnFailure: true,
            reporter: ['text', 'json-summary', 'html', 'json'],
            reportsDirectory: './coverage',
            include: ['packages/**/src/**', 'src/**'],
            exclude: [
                '**/node_modules/**',
                '**/lib/**',
                '**/dist/**',
                '**/*.d.ts',
                '**/*.test.ts',
                '**/*.test.tsx',
                '**/tests/**',
                '**/__tests__/**',
                '**/index.ts',
                // Not part of the test projects (deprecated, no tests run).
                'packages/deprecated/**',
            ],
        },
    },
});
