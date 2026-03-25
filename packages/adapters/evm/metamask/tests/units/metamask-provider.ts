import { EventEmitter } from '@tronweb3/abstract-adapter-evm';
import type { EIP1193Provider } from '@tronweb3/abstract-adapter-evm';
export class MetaMaskProvider extends EventEmitter {
    isMetaMask = true;
    providers = [MetaMaskProvider];
    constructor() {
        super();
    }

    request<P = unknown[], T = unknown>({ method }: { method: string; params?: P }): Promise<T> {
        if (method === 'eth_accounts') {
            return Promise.resolve(this._accountsRes as T);
        }
        if (method === 'eth_requestAccounts') {
            this.emit('accountsChanged', this._requestAccountsRes);
            return Promise.resolve(this._requestAccountsRes as T);
        }
        if (method === 'personal_sign') {
            return Promise.resolve(this._personalSignRes as T);
        }
        return Promise.resolve(null as T);
    }

    _accountsRes: string[] = [];
    _requestAccountsRes: string[] = [];
    _personalSignRes = '';
    _setAccountsRes(accounts: string[]) {
        this._accountsRes = accounts;
    }
    _setRequestAccountsRes(accounts: string[]) {
        this._requestAccountsRes = accounts;
    }
    _setPersonalSignRes(res: string) {
        this._personalSignRes = res;
    }
}

export function installMetaMaskEIP6963Provider(
    provider: EIP1193Provider,
    options: { name?: string; rdns?: string } = {}
) {
    const detail = {
        info: {
            uuid: `${options.rdns || 'io.metamask'}-${options.name || 'MetaMask'}`,
            name: options.name || 'MetaMask',
            icon: '',
            rdns: options.rdns || 'io.metamask',
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
