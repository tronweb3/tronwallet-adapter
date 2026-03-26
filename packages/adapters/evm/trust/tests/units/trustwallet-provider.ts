import { EventEmitter } from '@tronweb3/abstract-adapter-evm';
import type { EIP1193Provider, ProviderRpcError } from '@tronweb3/abstract-adapter-evm';
import { TRUST_WALLET_RDNS } from '../../src/utils.js';

export class TrustWalletProvider extends EventEmitter {
    isMetaMask = false;
    isTrust = true;

    private _accountsRes: string[] = [];
    private _requestAccountsRes: string[] = [];
    private _signTypedDataRes = '';
    private _requestAccountsError: ProviderRpcError | null = null;

    request<P = unknown[], T = unknown>({ method, params }: { method: string; params?: P }): Promise<T> {
        if (method === 'eth_accounts') {
            return Promise.resolve(this._accountsRes as T);
        }

        if (method === 'eth_requestAccounts') {
            if (this._requestAccountsError) {
                return Promise.reject(this._requestAccountsError);
            }

            this.emit('accountsChanged', this._requestAccountsRes);
            return Promise.resolve(this._requestAccountsRes as T);
        }

        if (method === 'eth_signTypedData_v4') {
            return Promise.resolve(this._signTypedDataRes as T);
        }

        if (
            method === 'wallet_switchEthereumChain' ||
            method === 'wallet_watchAsset' ||
            method === 'wallet_addEthereumChain' ||
            method === 'eth_sendTransaction'
        ) {
            return Promise.resolve(null as T);
        }

        return Promise.resolve((params || null) as T);
    }

    _setAccountsRes(accounts: string[]) {
        this._accountsRes = accounts;
    }

    _setRequestAccountsRes(accounts: string[]) {
        this._requestAccountsRes = accounts;
    }

    _setSignTypedDataRes(res: string) {
        this._signTypedDataRes = res;
    }

    _setRequestAccountsError(error: ProviderRpcError | null) {
        this._requestAccountsError = error;
    }
}

export function installTrustWalletProvider(provider: EIP1193Provider, options: { name?: string; rdns?: string } = {}) {
    const detail = {
        info: {
            uuid: `${options.rdns || TRUST_WALLET_RDNS}-${options.name || 'Trust Wallet'}`,
            name: options.name || 'Trust Wallet',
            icon: '',
            rdns: options.rdns || TRUST_WALLET_RDNS,
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
