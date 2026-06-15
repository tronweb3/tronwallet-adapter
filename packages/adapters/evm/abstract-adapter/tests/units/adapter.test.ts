import { vi, describe, beforeEach, test, expect } from 'vitest';
import { Adapter, WalletReadyState } from '../../src/adapter.js';
import type { Asset, Chain, AdapterName } from '../../src/adapter.js';
import type { EIP1193Provider } from '../../src/eip1193-provider.js';

const provider = {
    request: vi.fn(),
} as unknown as EIP1193Provider;

class TestAdapter extends Adapter {
    name = 'Test' as AdapterName<'Test'>;
    icon = 'https://icon.com/test-icon.png';
    url = 'https://test-wallet.com';
    address: null | string = null;
    readyState = WalletReadyState.Found;

    constructor() {
        super();
    }

    getProvider = vi.fn(() => Promise.resolve(provider));
    async connect() {
        return Promise.resolve('address1');
    }
    async signTypedData(): Promise<string> {
        return Promise.resolve('signature');
    }
}

class DetectAdapter extends Adapter {
    name = 'Detect' as AdapterName<'Detect'>;
    icon = 'https://icon.com/test-icon.png';
    url = 'https://test-wallet.com';
    address: null | string = null;
    readyState = WalletReadyState.Found;

    constructor(private readonly injectedProvider: EIP1193Provider | null = null) {
        super();
        this.eip6963Info.support = true;
        this.eip6963Info.name = 'Detect';
    }

    protected getInjectedProvider(): EIP1193Provider | null {
        return this.injectedProvider;
    }

    async connect() {
        return Promise.resolve('address1');
    }

    async signTypedData(): Promise<string> {
        return Promise.resolve('signature');
    }
}

function installEIP6963Provider(provider: EIP1193Provider, name = 'Detect') {
    const detail = {
        info: {
            uuid: `io.test.${name}`,
            name,
            icon: '',
            rdns: `io.test.${name}`,
        },
        provider,
    };

    const onRequestProvider = () => {
        window.dispatchEvent(
            new CustomEvent('eip6963:announceProvider', {
                detail,
            })
        );
    };

    window.addEventListener('eip6963:requestProvider', onRequestProvider);

    return () => {
        window.removeEventListener('eip6963:requestProvider', onRequestProvider);
    };
}

let adapter: TestAdapter;
beforeEach(() => {
    adapter = new TestAdapter();
    adapter.address = '0xsome address';
    provider.request = vi.fn();
    vi.clearAllMocks();
});
describe('#AbstractAdapter', () => {
    test('#getProvider() should resolve provider via EIP-6963', async () => {
        const detectedProvider = { request: vi.fn() } as unknown as EIP1193Provider;
        const cleanup = installEIP6963Provider(detectedProvider);
        const detectAdapter = new DetectAdapter();

        await expect(detectAdapter.getProvider()).resolves.toBe(detectedProvider);

        cleanup();
    });
    test('#getProvider() should prefer injected provider', async () => {
        const injectedProvider = { request: vi.fn() } as unknown as EIP1193Provider;
        const detectAdapter = new DetectAdapter(injectedProvider);

        await expect(detectAdapter.getProvider()).resolves.toBe(injectedProvider);
    });
    test('#autoConnect() should swallow eth_accounts errors and reset address', async () => {
        provider.request = vi.fn(() => Promise.reject(new Error('eth_accounts failed')));

        await expect((adapter as any).autoConnect(provider)).resolves.toBeUndefined();
        expect(adapter.address).toBeNull();
    });
    test('#connected should be correct', () => {
        expect(adapter.connected).toEqual(true);
        adapter.address = '';
        expect(adapter.connected).toEqual(false);
    });
    test('#signMessage() should work fine', async () => {
        const message = 'Hello';
        await adapter.signMessage({ message });
        expect(adapter.getProvider).toHaveBeenCalledTimes(1);
        expect(provider.request).toHaveBeenCalledWith({ method: 'personal_sign', params: [message, adapter.address] });
    });
    test('#signMessage() with address should work fine', async () => {
        const message = 'Hello';
        const address = 'address';
        await adapter.signMessage({ message, address });
        expect(adapter.getProvider).toHaveBeenCalledTimes(1);
        expect(provider.request).toHaveBeenCalledWith({ method: 'personal_sign', params: [message, address] });
    });
    test('#signMessage() should throw error when provider.request throw error', async () => {
        const error: any = new Error('user rejected');
        error.code = '30003';
        error.data = 'some data';
        provider.request = vi.fn(() => {
            throw error;
        });
        await expect(adapter.signMessage({ message: 'hello' })).rejects.toEqual(error);
    });
    test('#sendTransaction() should work fine', async () => {
        const transaction = {
            from: 'address from',
            to: 'address to',
            value: '0x03',
        };
        await adapter.sendTransaction(transaction);
        expect(adapter.getProvider).toHaveBeenCalledTimes(1);
        expect(provider.request).toHaveBeenCalledWith({ method: 'eth_sendTransaction', params: [transaction] });
    });
    test('#addChain() should work fine', async () => {
        const chainInfo: Chain = {
            chainId: '0x539',
            chainName: 'Localhost',
            nativeCurrency: {
                name: 'Ethereum Token',
                symbol: 'ETH',
                decimals: 18,
            },
            rpcUrls: ['https://rpc-url.com'],
        };
        await adapter.addChain(chainInfo);
        expect(adapter.getProvider).toHaveBeenCalledTimes(1);
        expect(provider.request).toHaveBeenCalledWith({ method: 'wallet_addEthereumChain', params: [chainInfo] });
    });
    test('#addChain() should work fine', async () => {
        const chainId = '0x539';
        await adapter.switchChain(chainId);
        expect(adapter.getProvider).toHaveBeenCalledTimes(1);
        expect(provider.request).toHaveBeenCalledWith({ method: 'wallet_switchEthereumChain', params: [{ chainId }] });
    });
    test('#watchAsset() should work fine', async () => {
        const asset: Asset = {
            type: 'ERC20',
            options: {
                address: '0xtoken address',
                symbol: 'USDT',
                decimals: 18,
            },
        };
        await adapter.watchAsset(asset);
        expect(adapter.getProvider).toHaveBeenCalledTimes(1);
        expect(provider.request).toHaveBeenCalledWith({ method: 'wallet_watchAsset', params: asset });
    });
});
