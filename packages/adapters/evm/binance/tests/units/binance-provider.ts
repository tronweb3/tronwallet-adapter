import { EventEmitter } from '@tronweb3/abstract-adapter-evm';
import type { EIP1193Provider } from '@tronweb3/abstract-adapter-evm';

export class BinanceProvider extends EventEmitter {
    isMetaMask = false;
    isBinance = true;

    request<P = unknown[], T = unknown>({ method }: { method: string; params?: P }): Promise<T> {
        if (method === 'eth_accounts') {
            return Promise.resolve(this._accountsRes as T);
        }

        if (method === 'eth_requestAccounts') {
            this.emit('accountsChanged', this._requestAccountsRes);
            return Promise.resolve(this._requestAccountsRes as T);
        }

        return Promise.resolve(null as T);
    }

    private _accountsRes: string[] = [];
    private _requestAccountsRes: string[] = [];

    _setAccountsRes(accounts: string[]) {
        this._accountsRes = accounts;
    }

    _setRequestAccountsRes(accounts: string[]) {
        this._requestAccountsRes = accounts;
    }
}

export function installBinanceEIP6963Provider(
    provider: EIP1193Provider,
    options: { name?: string; rdns?: string } = {}
) {
    const detail = {
        info: {
            uuid: `${options.rdns || 'com.binance.wallet'}-${options.name || 'Binance Wallet'}`,
            name: options.name || 'Binance Wallet',
            icon: '',
            rdns: options.rdns || 'com.binance.wallet',
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
