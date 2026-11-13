import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { LockerAdapter } from '../../src/adapter.js';
import { getLockerProvider, supportLocker, LockerRdns } from '../../src/utils.js';
import {
    AdapterState,
    WalletReadyState,
    WalletConnectionError,
    WalletDisconnectedError,
    WalletSignMessageError,
    WalletSignTransactionError,
    WalletGetNetworkError,
    TIP6963AnnounceProviderEventName,
    TIP6963RequestProviderEventName,
} from '@tronweb3/tronwallet-abstract-adapter';

const ADDRESS = 'TKcEU8ekq2ZoFzLSGFYCUY6aocJBX9X3Fa';

function makeProvider(extra: Record<string, unknown> = {}) {
    return {
        isLockerWallet: true,
        isTronLink: true,
        request: vi.fn().mockResolvedValue([ADDRESS]),
        on: vi.fn(),
        removeListener: vi.fn(),
        tronWeb: {
            defaultAddress: { base58: ADDRESS },
            trx: {
                sign: vi.fn().mockResolvedValue({ signature: ['tx'] }),
                signMessageV2: vi.fn().mockResolvedValue('0xmsg'),
            },
        },
        ...extra,
    };
}

/** A wallet that answers TIP6963:requestProvider with its own announcement, as the TIP asks. */
function announceOnRequest(rdns: string, provider: unknown) {
    const handler = () =>
        window.dispatchEvent(
            new CustomEvent(TIP6963AnnounceProviderEventName, {
                detail: Object.freeze({ info: { uuid: 'u', name: 'Wallet', icon: 'data:,', rdns }, provider }),
            })
        );
    window.addEventListener(TIP6963RequestProviderEventName, handler);
    return () => window.removeEventListener(TIP6963RequestProviderEventName, handler);
}

let cleanups: (() => void)[] = [];
beforeEach(function () {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ wallets: {} }) }));
    delete (window as any).tron;
});
afterEach(function () {
    cleanups.forEach((c) => c());
    cleanups = [];
    delete (window as any).tron;
    vi.unstubAllGlobals();
});

describe('utils', () => {
    test('finds the provider Locker Wallet announces through TIP-6963', () => {
        const provider = makeProvider();
        cleanups.push(announceOnRequest(LockerRdns, provider));
        expect(getLockerProvider()).toBe(provider);
        expect(supportLocker()).toBe(true);
    });
    test('ignores the TIP-6963 announcements of other wallets', () => {
        cleanups.push(announceOnRequest('org.tronlink.www', makeProvider({ isLockerWallet: false })));
        expect(getLockerProvider()).toBeNull();
    });
    test('prefers the announced provider when another wallet owns window.tron', () => {
        const locker = makeProvider();
        (window as any).tron = makeProvider({ isLockerWallet: false });
        cleanups.push(announceOnRequest(LockerRdns, locker));
        expect(getLockerProvider()).toBe(locker);
    });
    test('falls back to window.tron when it is marked isLockerWallet', () => {
        const provider = makeProvider();
        (window as any).tron = provider;
        expect(getLockerProvider()).toBe(provider);
    });
    test('does not take a window.tron that is not Locker Wallet', () => {
        (window as any).tron = makeProvider({ isLockerWallet: undefined });
        expect(supportLocker()).toBe(false);
    });
});

describe('LockerAdapter', () => {
    test('#constructor() should work fine', () => {
        const adapter = new LockerAdapter();
        expect(adapter.name).toEqual('Locker Wallet');
        expect(adapter.url).toEqual('https://lockerprotocol.com');
        expect(adapter.icon.startsWith('data:image/svg+xml;base64,')).toBe(true);
        expect(adapter).toHaveProperty('readyState');
        expect(adapter).toHaveProperty('connect');
        expect(adapter).toHaveProperty('disconnect');
        expect(adapter).toHaveProperty('signMessage');
        expect(adapter).toHaveProperty('signTransaction');
    });
    test('is Found at once when the wallet is already there', () => {
        (window as any).tron = makeProvider();
        const adapter = new LockerAdapter();
        expect(adapter.readyState).toBe(WalletReadyState.Found);
        expect(adapter.state).toBe(AdapterState.Disconnect);
    });

    function makeConnectedAdapter() {
        const adapter = new LockerAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._state = AdapterState.Connected;
        (adapter as any)._address = ADDRESS;
        (adapter as any)._wallet = makeProvider();
        adapter.on('error', () => {});
        return adapter;
    }

    describe('#connect()', () => {
        test('asks for the account with tron_requestAccounts and connects', async () => {
            const provider = makeProvider();
            (window as any).tron = provider;
            const adapter = new LockerAdapter();
            const onConnect = vi.fn();
            adapter.on('connect', onConnect);
            await adapter.connect();
            expect(provider.request).toHaveBeenCalledWith({ method: 'tron_requestAccounts' });
            expect(adapter.address).toBe(ADDRESS);
            expect(adapter.state).toBe(AdapterState.Connected);
            expect(onConnect).toHaveBeenCalledWith(ADDRESS);
        });
        test('throws WalletConnectionError when no account comes back', async () => {
            (window as any).tron = makeProvider({ request: vi.fn().mockResolvedValue([]) });
            const adapter = new LockerAdapter();
            adapter.on('error', () => {});
            await expect(adapter.connect()).rejects.toBeInstanceOf(WalletConnectionError);
            expect((adapter as any)._connecting).toBe(false);
        });
        test('wraps a refusal in WalletConnectionError', async () => {
            const refused = Object.assign(new Error('User rejected the request.'), { code: 4001 });
            (window as any).tron = makeProvider({ request: vi.fn().mockRejectedValue(refused) });
            const adapter = new LockerAdapter();
            adapter.on('error', () => {});
            await expect(adapter.connect()).rejects.toBeInstanceOf(WalletConnectionError);
        });
    });

    describe('#disconnect()', () => {
        test('clears the address, sets Disconnect and emits disconnect', async () => {
            const adapter = makeConnectedAdapter();
            const onDisconnect = vi.fn();
            adapter.on('disconnect', onDisconnect);
            await adapter.disconnect();
            expect(adapter.address).toBeNull();
            expect(adapter.state).toBe(AdapterState.Disconnect);
            expect(onDisconnect).toHaveBeenCalledTimes(1);
        });
    });

    describe('#network()', () => {
        test('throws WalletDisconnectedError when not connected', async () => {
            const adapter = new LockerAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Disconnect;
            adapter.on('error', () => {});
            await expect(adapter.network()).rejects.toBeInstanceOf(WalletDisconnectedError);
        });
        test('wraps provider errors in WalletGetNetworkError', async () => {
            const adapter = makeConnectedAdapter();
            (adapter as any)._wallet.tronWeb.fullNode = { host: 'https://broken' };
            vi.unstubAllGlobals();
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));
            await expect(adapter.network()).rejects.toBeInstanceOf(WalletGetNetworkError);
        });
    });

    describe('#signTransaction()', () => {
        test('signs through tronWeb.trx.sign', async () => {
            const adapter = makeConnectedAdapter();
            const tx = { txID: 'abc' } as any;
            expect(await adapter.signTransaction(tx)).toEqual({ signature: ['tx'] });
            expect((adapter as any)._wallet.tronWeb.trx.sign).toHaveBeenCalledWith(tx);
        });
        test('wraps a refusal in WalletSignTransactionError', async () => {
            const adapter = makeConnectedAdapter();
            (adapter as any)._wallet.tronWeb.trx.sign.mockRejectedValueOnce(new Error('User rejected the request.'));
            await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletSignTransactionError);
        });
        test('throws WalletDisconnectedError when not connected', async () => {
            const adapter = new LockerAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Disconnect;
            adapter.on('error', () => {});
            await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletDisconnectedError);
        });
    });

    describe('#signMessage()', () => {
        test('signs through tronWeb.trx.signMessageV2', async () => {
            const adapter = makeConnectedAdapter();
            expect(await adapter.signMessage('hello')).toBe('0xmsg');
            expect((adapter as any)._wallet.tronWeb.trx.signMessageV2).toHaveBeenCalledWith('hello');
        });
        test('wraps errors in WalletSignMessageError', async () => {
            const adapter = makeConnectedAdapter();
            (adapter as any)._wallet.tronWeb.trx.signMessageV2.mockRejectedValueOnce(new Error('m-fail'));
            await expect(adapter.signMessage('hi')).rejects.toBeInstanceOf(WalletSignMessageError);
        });
    });

    test('_openAppByDeepLinkIfNeed always returns false (a desktop extension, no deep link)', () => {
        const adapter = new LockerAdapter();
        expect((adapter as any)._openAppByDeepLinkIfNeed()).toBe(false);
    });
});
