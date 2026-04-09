import { EventEmitter } from '@tronweb3/abstract-adapter-evm';
import type { EIP1193Provider } from '@tronweb3/abstract-adapter-evm';

export class TronLinkProvider extends EventEmitter {
    isMetaMask = false;
    isTronLink = true;
    selectedAddress: string | null = null;

    request<P = unknown[], T = unknown>({ method }: { method: string; params?: P }): Promise<T> {
        if (method === 'eth_accounts') {
            return Promise.resolve((this.selectedAddress ? [this.selectedAddress] : []) as T);
        }

        if (method === 'eth_requestAccounts') {
            const accounts = this.selectedAddress ? [this.selectedAddress] : [];
            this.emit('accountsChanged', accounts);
            return Promise.resolve(accounts as T);
        }

        return Promise.resolve(null as T);
    }
}

export function installTronLinkEIP6963Provider(
    provider: EIP1193Provider,
    options: { name?: string; rdns?: string } = {}
) {
    const detail = {
        info: {
            uuid: `${options.rdns || 'org.tronlink.www'}-${options.name || 'TronLink'}`,
            name: options.name || 'TronLink',
            icon: '',
            rdns: options.rdns || 'org.tronlink.www',
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
