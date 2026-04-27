import type { TronWeb } from 'tronweb';
import type { TypedDataDomain, TypedDataField } from 'tronweb/utils';
export type { TronWeb } from 'tronweb';
export enum NetworkType {
    Mainnet = 'Mainnet',
    Shasta = 'Shasta',
    Nile = 'Nile',
    /**
     * When use custom node
     */
    Unknown = 'Unknown',
}

export enum ChainNetwork {
    Mainnet = 'Mainnet',
    Shasta = 'Shasta',
    Nile = 'Nile',
}

export type Network = {
    networkType: NetworkType;
    chainId: string;
    fullNode: string;
    solidityNode: string;
    eventServer: string;
};
/**
 * @deprecated Use Network instead.
 */
export type NetworkNodeConfig = {
    chainId: string;
    chain: string;
    fullNode: string;
    solidityNode: string;
    eventServer: string;
};

export type { Transaction, SignedTransaction } from 'tronweb/lib/esm/types/Transaction';

/**
 * Typed data object for signTypedData, following [TIP-712](https://github.com/tronprotocol/tips/blob/master/tip-712.md) style structure.
 */
export interface TypedData {
    domain: TypedDataDomain;
    types: Record<string, TypedDataField[]>;
    message: Record<string, unknown>;
}

export const TIP6963AnnounceProviderEventName = 'TIP6963:announceProvider' as const;
export const TIP6963RequestProviderEventName = 'TIP6963:requestProvider' as const;
export interface RequestArguments {
    readonly method: string;
    readonly params?: unknown[] | object;
}
export interface TIP1193Provider {
    request: (args: RequestArguments) => Promise<unknown>;
    on(event: string, listener: (...args: unknown[]) => void): this;
    removeListener(event: string, listener: (...args: unknown[]) => void): this;
    tronWeb: TronWeb;
    [key: `is${string}`]: boolean;
}
export interface TIP6963ProviderInfo {
    uuid: string;
    name: string;
    icon: string;
    rdns: string;
}

export interface TIP6963ProviderDetail {
    info: TIP6963ProviderInfo;
    provider: TIP1193Provider;
}

// Announce Event dispatched by a Wallet
export interface TIP6963AnnounceProviderEvent extends CustomEvent {
    type: typeof TIP6963AnnounceProviderEventName;
    detail: TIP6963ProviderDetail;
}

declare global {
    interface WindowEventMap {
        [TIP6963AnnounceProviderEventName]: TIP6963AnnounceProviderEvent;
    }
}
