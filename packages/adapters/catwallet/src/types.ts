import type { TronWeb } from '@tronweb3/tronwallet-abstract-adapter';

export type { TronWeb };

interface TronRequestArguments {
    readonly method: string;
    readonly params?: unknown[] | object;
}

interface ProviderRpcError extends Error {
    code: number;
    message: string;
    data?: unknown;
}

type CatWalletTronEvent = 'connect' | 'disconnect' | 'chainChanged' | 'accountsChanged';

export type CatWalletTronConnectCallback = (data: { chainId: string }) => void;
export type CatWalletTronChainChangedCallback = CatWalletTronConnectCallback;
export type CatWalletTronDisconnectCallback = (error: ProviderRpcError) => void;
export type CatWalletTronAccountsChangedCallback = (data: [string?]) => void;

export interface CatWalletTron {
    request(args: { method: 'eth_requestAccounts' }): Promise<[string]>;
    request(args: { method: 'tron_requestAccounts' }): Promise<[string]>;
    request(args: TronRequestArguments): Promise<unknown>;

    on(event: 'connect', cb: CatWalletTronConnectCallback): void;
    on(event: 'disconnect', cb: CatWalletTronDisconnectCallback): void;
    on(event: 'chainChanged', cb: CatWalletTronChainChangedCallback): void;
    on(event: 'accountsChanged', cb: CatWalletTronAccountsChangedCallback): void;

    removeListener(event: CatWalletTronEvent, cb: unknown): void;
    tronWeb: TronWeb | false;
    isCatWallet: boolean;
    isTronLink: boolean;
    ready: boolean;
}
