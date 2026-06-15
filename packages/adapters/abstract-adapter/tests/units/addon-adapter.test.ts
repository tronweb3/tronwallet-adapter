import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AddonAdapter } from '../../src/addon-adapter.js';
import type { SignedTransaction, Transaction } from '../../src/types.js';
import { AdapterState, WalletReadyState } from '../../src/types.js';
import { WalletNotFoundError } from '../../src/errors.js';
import { defaultSecurityOptions, clearCache } from '../../src/security.js';
import type { Risk, RiskConfig } from '../../src/security.js';
import type { BaseAdapterConfig } from '../../src/adapter.js';

/**
 * Concrete implementation of AddonAdapter for testing purposes.
 * This class extends AddonAdapter and exposes protected methods and properties
 * as public methods to enable comprehensive unit testing.
 */
class TestAddonAdapter extends AddonAdapter {
    name = 'TestAdapter' as any;
    url = 'https://test-wallet.com';
    icon = 'test-icon-svg';

    private mockReadyState: WalletReadyState = WalletReadyState.NotFound;
    private mockState: AdapterState = AdapterState.NotFound;
    private mockConnecting = false;
    private mockAddress: string | null = null;
    private shouldWalletExist = false;
    private shouldOpenApp = false;

    get readyState(): WalletReadyState {
        return this.mockReadyState;
    }

    get state(): AdapterState {
        return this.mockState;
    }

    get connecting(): boolean {
        return this.mockConnecting;
    }

    get connected(): boolean {
        return this.state === AdapterState.Connected;
    }

    get address(): string | null {
        return this.mockAddress;
    }

    async connect(): Promise<void> {
        await this._beforeConnect();
    }
    async signMessage(): Promise<string> {
        return '';
    }
    async signTransaction(transaction: Transaction): Promise<SignedTransaction> {
        return {
            ...transaction,
            signature: [''],
        };
    }

    async testBeforeConnect(): Promise<boolean> {
        return this._beforeConnect();
    }

    async checkSecurity(): Promise<void> {
        return super.checkSecurity();
    }

    getCommonConfig(): Required<BaseAdapterConfig> {
        return this.commonConfig;
    }

    setMockReadyState(state: WalletReadyState): void {
        this.mockReadyState = state;
    }

    setMockState(state: AdapterState): void {
        this.mockState = state;
    }

    setMockConnecting(connecting: boolean): void {
        this.mockConnecting = connecting;
    }

    setMockAddress(address: string | null): void {
        this.mockAddress = address;
    }

    setWalletExistence(exists: boolean): void {
        this.shouldWalletExist = exists;
    }

    setOpenAppResponse(shouldOpen: boolean): void {
        this.shouldOpenApp = shouldOpen;
    }

    protected async _checkWallet(): Promise<boolean> {
        if (this.shouldWalletExist) {
            this.setMockReadyState(WalletReadyState.Found);
            return true;
        }
        this.setMockReadyState(WalletReadyState.NotFound);
        return false;
    }

    protected _openAppByDeepLinkIfNeed(): boolean {
        return this.shouldOpenApp;
    }
}

const TEST_CONFIG_URL = 'https://example.com/cfg.json';
const TEST_CONFIG_URLS = [TEST_CONFIG_URL];

const mockRisk: Risk = {
    noticeType: 1,
    title: 'security-risk-1',
    ext: '>=1.0.0',
    ios: '>=1.0.0',
    and: '>=1.0.0',
};

const buildConfig = (wallets: Record<string, Risk[]> = {}): RiskConfig => ({
    v: '1.0.0',
    ts: 1735286400000,
    wallets,
});

const mockFetch = (config: RiskConfig) => {
    vi.stubGlobal(
        'fetch',
        vi.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve(config),
            } as Response)
        )
    );
};

describe('AddonAdapter', () => {
    let adapter: TestAddonAdapter;
    let windowOpenSpy: any;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllGlobals();
        clearCache();
        adapter = new TestAddonAdapter();
        windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        clearCache();
    });

    describe('constructor and configuration', () => {
        /**
         * Test that AddonAdapter initializes with default configuration values
         * when no parameters are provided to the constructor
         */
        it('should initialize with default config when no params provided', () => {
            const newAdapter = new TestAddonAdapter();
            const config = newAdapter.getCommonConfig();

            expect(config.checkTimeout).toBe(2 * 1000);
            expect(config.openAppWithDeeplink).toBe(true);
            expect(config.openUrlWhenWalletNotFound).toBe(true);
            expect(config.securityOptions).toEqual(defaultSecurityOptions);
        });

        /**
         * Test that the default security check is disabled (enabled: false)
         */
        it('should disable security check by default', () => {
            const newAdapter = new TestAddonAdapter();
            expect(newAdapter.getCommonConfig().securityOptions.enabled).toBe(false);
        });

        /**
         * Test that defaultSecurityOptions exposes configUrls as an array
         */
        it('should expose configUrls as an empty array in defaults', () => {
            expect(Array.isArray(defaultSecurityOptions.configUrls)).toBe(true);
            expect(defaultSecurityOptions.configUrls).toEqual([]);
        });

        /**
         * Test that custom configuration parameters are properly merged with default values
         * ensuring that specified values override defaults while others remain unchanged
         */
        it('should merge provided config with defaults', () => {
            const customConfig: BaseAdapterConfig = {
                checkTimeout: 5000,
                openUrlWhenWalletNotFound: false,
                openAppWithDeeplink: false,
            };
            const newAdapter = new TestAddonAdapter(customConfig);
            const config = newAdapter.getCommonConfig();

            expect(config.checkTimeout).toBe(5000);
            expect(config.openUrlWhenWalletNotFound).toBe(false);
            expect(config.openAppWithDeeplink).toBe(false);
            expect(config.securityOptions).toEqual(defaultSecurityOptions);
        });

        /**
         * Test that the constructor throws an error when checkTimeout is not a valid number
         * This ensures proper validation of configuration parameters
         */
        it('should throw error for invalid checkTimeout', () => {
            expect(() => {
                new TestAddonAdapter({ checkTimeout: 'invalid' as any });
            }).toThrow('[WalletAdapter] config.checkTimeout should be a number');
        });

        /**
         * Test that checkTimeout accepts zero as a valid value
         */
        it('should accept zero as a valid checkTimeout value', () => {
            const newAdapter = new TestAddonAdapter({ checkTimeout: 0 });
            expect(newAdapter.getCommonConfig().checkTimeout).toBe(0);
        });

        /**
         * Test that the constructor throws when security check is enabled but configUrls is missing
         */
        it('should throw when enabled is true but configUrls is not provided', () => {
            expect(() => {
                new TestAddonAdapter({
                    securityOptions: { enabled: true },
                });
            }).toThrow(/config\.securityOptions\.configUrls is required/);
        });

        /**
         * Test that the constructor throws when security check is enabled but configUrls is empty
         */
        it('should throw when enabled is true but configUrls is an empty array', () => {
            expect(() => {
                new TestAddonAdapter({
                    securityOptions: { enabled: true, configUrls: [] },
                });
            }).toThrow(/config\.securityOptions\.configUrls is required/);
        });

        /**
         * Test that the constructor does not validate configUrls when security check is disabled
         */
        it('should not require configUrls when enabled is false', () => {
            expect(() => {
                new TestAddonAdapter({
                    securityOptions: { enabled: false },
                });
            }).not.toThrow();
        });

        /**
         * Test that the constructor succeeds when enabled is true and configUrls has entries
         */
        it('should accept enabled true with non-empty configUrls', () => {
            expect(() => {
                new TestAddonAdapter({
                    securityOptions: { enabled: true, configUrls: TEST_CONFIG_URLS },
                });
            }).not.toThrow();
        });
    });

    describe('updateSecurityOptions method', () => {
        /**
         * Test that provided options are merged into the existing securityOptions
         * rather than replacing them wholesale.
         */
        it('should merge provided options into the existing config', () => {
            adapter.updateSecurityOptions({ enabled: true, configUrls: TEST_CONFIG_URLS });
            const { securityOptions } = adapter.getCommonConfig();

            expect(securityOptions.enabled).toBe(true);
            expect(securityOptions.configUrls).toEqual(TEST_CONFIG_URLS);
            // Untouched defaults remain in place.
            expect(securityOptions.timeout).toBe(defaultSecurityOptions.timeout);
            expect(securityOptions.cacheTTL).toBe(defaultSecurityOptions.cacheTTL);
        });

        /**
         * Test that the same configUrls validation as the constructor is applied,
         * and that an invalid update leaves the previous config untouched.
         */
        it('should throw when enabling security check without configUrls and keep the old config', () => {
            expect(() => {
                adapter.updateSecurityOptions({ enabled: true });
            }).toThrow(/config\.securityOptions\.configUrls is required/);
            expect(adapter.getCommonConfig().securityOptions.enabled).toBe(false);
        });

        /**
         * Test that updating the options clears the cached security check result so
         * the next checkSecurity runs a fresh check with the new configuration.
         */
        it('should reset the cached security check so the next check runs again', async () => {
            mockFetch(buildConfig({ TestAdapter: [mockRisk] }));
            const onRiskDetected = vi.fn(async () => {});
            adapter.updateSecurityOptions({ enabled: true, configUrls: TEST_CONFIG_URLS, onRiskDetected });

            await adapter.checkSecurity();
            // Second call within the TTL is served from the cached check result.
            await adapter.checkSecurity();
            expect(onRiskDetected).toHaveBeenCalledTimes(1);

            // Updating the options invalidates the cached check → it runs again.
            adapter.updateSecurityOptions({ onRiskDetected });
            await adapter.checkSecurity();
            expect(onRiskDetected).toHaveBeenCalledTimes(2);
        });
    });

    describe('_beforeConnect method', () => {
        /**
         * Test that _beforeConnect returns early without performing any checks
         * when the adapter is already in a connected state
         */
        it('should return false and skip checks when already connected', async () => {
            adapter.setMockState(AdapterState.Connected);
            const checkWalletSpy = vi.spyOn(adapter as any, '_checkWallet');
            const checkSecuritySpy = vi.spyOn(adapter, 'checkSecurity');

            const proceed = await adapter.testBeforeConnect();

            expect(proceed).toBe(false);
            expect(checkWalletSpy).not.toHaveBeenCalled();
            expect(checkSecuritySpy).not.toHaveBeenCalled();
        });

        /**
         * Test that _beforeConnect returns early without performing wallet checks
         * when the adapter is already in the process of connecting
         */
        it('should return false and skip checks when already connecting', async () => {
            adapter.setMockConnecting(true);
            const checkWalletSpy = vi.spyOn(adapter as any, '_checkWallet');

            const proceed = await adapter.testBeforeConnect();

            expect(proceed).toBe(false);
            expect(checkWalletSpy).not.toHaveBeenCalled();
        });

        /**
         * Test that _beforeConnect returns true when the wallet is found and the
         * security check passes — i.e. the caller should proceed with connect.
         */
        it('should return true when wallet is found and security check passes', async () => {
            adapter.setWalletExistence(true);
            vi.spyOn(adapter, 'checkSecurity').mockResolvedValue();

            const proceed = await adapter.testBeforeConnect();

            expect(proceed).toBe(true);
        });

        /**
         * Test that _beforeConnect throws WalletNotFoundError when the wallet is not found
         * and the configuration allows opening the wallet URL in a new window
         */
        it('should throw WalletNotFoundError and open URL when wallet not found', async () => {
            adapter.setWalletExistence(false);
            adapter.setOpenAppResponse(false);

            await expect(adapter.testBeforeConnect()).rejects.toThrow(WalletNotFoundError);
            expect(windowOpenSpy).toHaveBeenCalledWith('https://test-wallet.com', '_blank');
        });

        /**
         * Test that _beforeConnect does not open URL when openUrlWhenWalletNotFound is disabled
         * even when the wallet is not found
         */
        it('should not open URL when openUrlWhenWalletNotFound is false', async () => {
            const configuredAdapter = new TestAddonAdapter({
                openUrlWhenWalletNotFound: false,
            });
            configuredAdapter.setWalletExistence(false);
            configuredAdapter.setOpenAppResponse(false);

            await expect(configuredAdapter.testBeforeConnect()).rejects.toThrow(WalletNotFoundError);
            expect(windowOpenSpy).not.toHaveBeenCalled();
        });

        /**
         * Test that _beforeConnect does not open URL when the _openAppByDeepLinkIfNeed method
         * successfully opens the app using deep linking
         */
        it('should not open URL if _openAppByDeepLinkIfNeed returns true', async () => {
            adapter.setWalletExistence(false);
            adapter.setOpenAppResponse(true);

            await expect(adapter.testBeforeConnect()).rejects.toThrow(WalletNotFoundError);
            expect(windowOpenSpy).not.toHaveBeenCalled();
        });

        /**
         * Test that _beforeConnect successfully proceeds through security checks
         * when the wallet is found and ready
         */
        it('should call checkSecurity when wallet is found', async () => {
            adapter.setWalletExistence(true);
            const checkSecuritySpy = vi.spyOn(adapter, 'checkSecurity').mockResolvedValue();

            await adapter.testBeforeConnect();

            expect(checkSecuritySpy).toHaveBeenCalled();
        });

        /**
         * Test that _beforeConnect propagates errors thrown by checkSecurity method
         */
        it('should propagate errors from checkSecurity', async () => {
            adapter.setWalletExistence(true);
            const testError = new Error('Security check failed');
            vi.spyOn(adapter, 'checkSecurity').mockRejectedValue(testError);

            await expect(adapter.testBeforeConnect()).rejects.toThrow('Security check failed');
        });
    });

    describe('checkSecurity method', () => {
        /**
         * Test that checkSecurity returns early without fetching when enabled is false (default)
         */
        it('should skip the security check when enabled is false', async () => {
            const fetchSpy = vi.fn();
            vi.stubGlobal('fetch', fetchSpy);

            await adapter.checkSecurity();

            expect(fetchSpy).not.toHaveBeenCalled();
        });

        /**
         * Test that checkSecurity retrieves risk configuration and triggers the onRiskDetected callback
         * when risks are found for the current adapter under the new `wallets` schema
         */
        it('should call onRiskDetected callback when risks are detected for this adapter', async () => {
            const mockRisks = [mockRisk];
            mockFetch(buildConfig({ TestAdapter: mockRisks }));

            const callbackSpy = vi.fn().mockResolvedValue(undefined);
            const configuredAdapter = new TestAddonAdapter({
                securityOptions: {
                    enabled: true,
                    configUrls: TEST_CONFIG_URLS,
                    onRiskDetected: callbackSpy,
                },
            });

            await configuredAdapter.checkSecurity();

            expect(callbackSpy).toHaveBeenCalledWith({ risks: mockRisks });
        });

        /**
         * Test that checkSecurity does not trigger onRiskDetected callback
         * when no risks are found for the current adapter
         */
        it('should not call onRiskDetected when no risks are detected for this adapter', async () => {
            mockFetch(buildConfig({ OtherAdapter: [mockRisk] }));

            const callbackSpy = vi.fn();
            const configuredAdapter = new TestAddonAdapter({
                securityOptions: {
                    enabled: true,
                    configUrls: TEST_CONFIG_URLS,
                    onRiskDetected: callbackSpy,
                },
            });

            await configuredAdapter.checkSecurity();

            expect(callbackSpy).not.toHaveBeenCalled();
        });

        /**
         * Test that checkSecurity uses the default onRiskDetected callback
         * when one is not explicitly configured
         */
        it('should use default onRiskDetected callback if not provided', async () => {
            const mockRisks: Risk[] = [{ noticeType: 2, title: 'test-risk' }];
            mockFetch(buildConfig({ TestAdapter: mockRisks }));

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {
                // noop
            });
            const configuredAdapter = new TestAddonAdapter({
                securityOptions: { enabled: true, configUrls: TEST_CONFIG_URLS },
            });

            await configuredAdapter.checkSecurity();

            expect(consoleSpy).toHaveBeenCalledWith('[WalletAdapter] Risk detected:', { risks: mockRisks });

            consoleSpy.mockRestore();
        });

        /**
         * Test that checkSecurity invokes onConfigFallback when all configUrls fail and no cache exists
         */
        it('should invoke onConfigFallback when all URLs fail with no cache', async () => {
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

            const onConfigFallbackSpy = vi.fn().mockResolvedValue(buildConfig());
            const configuredAdapter = new TestAddonAdapter({
                securityOptions: {
                    enabled: true,
                    configUrls: TEST_CONFIG_URLS,
                    onConfigFallback: onConfigFallbackSpy,
                    retries: 0,
                },
            });

            await expect(configuredAdapter.checkSecurity()).resolves.toBeUndefined();
            expect(onConfigFallbackSpy).toHaveBeenCalled();
        });

        /**
         * Test that checkSecurity defaults to "safe" (allow connection) when fetch fails
         * and no onConfigFallback is provided. The risk callback should not run.
         */
        it('should default to safe (no callback) when fetch fails without a fallback', async () => {
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

            const callbackSpy = vi.fn();
            const configuredAdapter = new TestAddonAdapter({
                securityOptions: {
                    enabled: true,
                    configUrls: TEST_CONFIG_URLS,
                    onRiskDetected: callbackSpy,
                    retries: 0,
                },
            });

            await expect(configuredAdapter.checkSecurity()).resolves.toBeUndefined();
            expect(callbackSpy).not.toHaveBeenCalled();
        });

        /**
         * Test that checkSecurity merges risks from multiple configUrls
         */
        it('should merge wallets entries from multiple configUrls', async () => {
            const riskA: Risk = { noticeType: 1, title: 'risk-a' };
            const riskB: Risk = { noticeType: 3, title: 'risk-b' };

            const fetchMock = vi.fn().mockImplementation((url: string) => {
                const config: RiskConfig =
                    url === 'https://a.example.com/cfg.json'
                        ? { v: '1.0.0', ts: 1, wallets: { TestAdapter: [riskA] } }
                        : { v: '1.0.1', ts: 2, wallets: { TestAdapter: [riskB] } };
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(config),
                } as Response);
            });
            vi.stubGlobal('fetch', fetchMock);

            const callbackSpy = vi.fn().mockResolvedValue(undefined);
            const configuredAdapter = new TestAddonAdapter({
                securityOptions: {
                    enabled: true,
                    configUrls: ['https://a.example.com/cfg.json', 'https://b.example.com/cfg.json'],
                    onRiskDetected: callbackSpy,
                },
            });

            await configuredAdapter.checkSecurity();

            expect(fetchMock).toHaveBeenCalledTimes(2);
            expect(callbackSpy).toHaveBeenCalledWith({ risks: [riskA, riskB] });
        });

        /**
         * Test that checkSecurity correctly passes security options to fetchJsonWithCache
         */
        it('should use custom security options from config', async () => {
            const customSecurityOptions = {
                enabled: true,
                configUrls: TEST_CONFIG_URLS,
                timeout: 5000,
                retries: 3,
            };

            const configuredAdapter = new TestAddonAdapter({
                securityOptions: customSecurityOptions,
            });

            mockFetch(buildConfig());

            await configuredAdapter.checkSecurity();

            expect(configuredAdapter.getCommonConfig().securityOptions.timeout).toBe(5000);
            expect(configuredAdapter.getCommonConfig().securityOptions.retries).toBe(3);
        });
    });

    describe('checkSecurity cache (5s TTL)', () => {
        /**
         * Test that concurrent calls in flight share the same promise so the
         * onRiskDetected callback only fires once.
         */
        it('should share the in-flight promise across concurrent calls', async () => {
            const callbackSpy = vi.fn().mockResolvedValue(undefined);
            const fetchSpy = vi.fn(() =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(buildConfig({ TestAdapter: [mockRisk] })),
                } as Response)
            );
            vi.stubGlobal('fetch', fetchSpy);

            const configuredAdapter = new TestAddonAdapter({
                securityOptions: {
                    enabled: true,
                    configUrls: TEST_CONFIG_URLS,
                    onRiskDetected: callbackSpy,
                },
            });

            await Promise.all([configuredAdapter.checkSecurity(), configuredAdapter.checkSecurity()]);

            expect(fetchSpy).toHaveBeenCalledTimes(1);
            expect(callbackSpy).toHaveBeenCalledTimes(1);
        });

        /**
         * Test that a settled result is reused on subsequent calls within the 5s window.
         */
        it('should reuse a settled result within the 5s window', async () => {
            const callbackSpy = vi.fn().mockResolvedValue(undefined);
            const fetchSpy = vi.fn(() =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(buildConfig({ TestAdapter: [mockRisk] })),
                } as Response)
            );
            vi.stubGlobal('fetch', fetchSpy);

            const configuredAdapter = new TestAddonAdapter({
                securityOptions: {
                    enabled: true,
                    configUrls: TEST_CONFIG_URLS,
                    onRiskDetected: callbackSpy,
                },
            });

            await configuredAdapter.checkSecurity();
            await configuredAdapter.checkSecurity();
            await configuredAdapter.checkSecurity();

            expect(fetchSpy).toHaveBeenCalledTimes(1);
            expect(callbackSpy).toHaveBeenCalledTimes(1);
        });

        /**
         * Test that the cache expires after the TTL window and a fresh check runs.
         */
        it('should re-run the check after the 5s TTL expires', async () => {
            vi.useFakeTimers();
            try {
                const callbackSpy = vi.fn().mockResolvedValue(undefined);
                const fetchSpy = vi.fn(() =>
                    Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve(buildConfig({ TestAdapter: [mockRisk] })),
                    } as Response)
                );
                vi.stubGlobal('fetch', fetchSpy);

                const configuredAdapter = new TestAddonAdapter({
                    securityOptions: {
                        enabled: true,
                        configUrls: TEST_CONFIG_URLS,
                        onRiskDetected: callbackSpy,
                        cacheTTL: 0, // disable security.ts URL cache so fetch is hit again
                    },
                });

                await configuredAdapter.checkSecurity();
                expect(fetchSpy).toHaveBeenCalledTimes(1);

                // Within TTL — cache hit, no new fetch
                vi.setSystemTime(Date.now() + 4_000);
                await configuredAdapter.checkSecurity();
                expect(fetchSpy).toHaveBeenCalledTimes(1);

                // After TTL — cache expired, fresh check
                vi.setSystemTime(Date.now() + 2_000);
                await configuredAdapter.checkSecurity();
                expect(fetchSpy).toHaveBeenCalledTimes(2);
                expect(callbackSpy).toHaveBeenCalledTimes(2);
            } finally {
                vi.useRealTimers();
            }
        });

        /**
         * Bug-1 regression: a slow fetch must NOT cause the TTL to "expire" while
         * the promise is still in flight. Otherwise a second call after the TTL
         * window would kick off a duplicate fetch (and a duplicate onRiskDetected).
         */
        it('should not start a duplicate fetch while the first promise is still pending, even past the TTL', async () => {
            vi.useFakeTimers();
            try {
                const callbackSpy = vi.fn().mockResolvedValue(undefined);
                let resolveFetch!: (resp: Response) => void;
                const fetchSpy = vi.fn(
                    () =>
                        new Promise<Response>((resolve) => {
                            resolveFetch = resolve;
                        })
                );
                vi.stubGlobal('fetch', fetchSpy);

                const configuredAdapter = new TestAddonAdapter({
                    securityOptions: {
                        enabled: true,
                        configUrls: TEST_CONFIG_URLS,
                        onRiskDetected: callbackSpy,
                    },
                });

                // First call — fetch is pending forever.
                const p1 = configuredAdapter.checkSecurity();

                // Advance past the TTL while the fetch is still pending.
                vi.setSystemTime(Date.now() + 90_000);

                // Second call — must reuse the in-flight promise, not start a new fetch.
                const p2 = configuredAdapter.checkSecurity();

                expect(fetchSpy).toHaveBeenCalledTimes(1);

                // Resolve and verify both share the same outcome.
                resolveFetch({
                    ok: true,
                    json: () => Promise.resolve(buildConfig({ TestAdapter: [mockRisk] })),
                } as Response);
                await Promise.all([p1, p2]);

                expect(callbackSpy).toHaveBeenCalledTimes(1);
            } finally {
                vi.useRealTimers();
            }
        });

        /**
         * Bug-2 regression: when the remote config has an entry for this adapter
         * but the risks array is empty, onRiskDetected must NOT be invoked.
         */
        it('should not invoke onRiskDetected when the risks array is empty', async () => {
            mockFetch(buildConfig({ TestAdapter: [] }));

            const callbackSpy = vi.fn();
            const configuredAdapter = new TestAddonAdapter({
                securityOptions: {
                    enabled: true,
                    configUrls: TEST_CONFIG_URLS,
                    onRiskDetected: callbackSpy,
                },
            });

            await configuredAdapter.checkSecurity();

            expect(callbackSpy).not.toHaveBeenCalled();
        });

        /**
         * Test that a rejected result is also cached within the TTL — the callback
         * is not retried while the cache is fresh.
         */
        it('should cache rejections within the TTL', async () => {
            const callbackSpy = vi.fn().mockRejectedValue(new Error('blocked'));
            const fetchSpy = vi.fn(() =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(buildConfig({ TestAdapter: [mockRisk] })),
                } as Response)
            );
            vi.stubGlobal('fetch', fetchSpy);

            const configuredAdapter = new TestAddonAdapter({
                securityOptions: {
                    enabled: true,
                    configUrls: TEST_CONFIG_URLS,
                    onRiskDetected: callbackSpy,
                },
            });

            await expect(configuredAdapter.checkSecurity()).rejects.toThrow('blocked');
            await expect(configuredAdapter.checkSecurity()).rejects.toThrow('blocked');

            expect(fetchSpy).toHaveBeenCalledTimes(1);
            expect(callbackSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('integration scenarios', () => {
        /**
         * Test the complete flow of _beforeConnect when all conditions are met for connection
         * including wallet availability and security checks
         */
        it('should successfully complete _beforeConnect flow with wallet found', async () => {
            adapter.setWalletExistence(true);
            mockFetch(buildConfig());

            await expect(adapter.testBeforeConnect()).resolves.toBe(true);
            expect(adapter.readyState).toBe(WalletReadyState.Found);
        });

        /**
         * Test that configuration can be overridden for individual adapter instances
         * without affecting other instances
         */
        it('should not share config between adapter instances', () => {
            const adapter1 = new TestAddonAdapter({ checkTimeout: 1000 });
            const adapter2 = new TestAddonAdapter({ checkTimeout: 5000 });

            expect(adapter1.getCommonConfig().checkTimeout).toBe(1000);
            expect(adapter2.getCommonConfig().checkTimeout).toBe(5000);
        });
    });
});
