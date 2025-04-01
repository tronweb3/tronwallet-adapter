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
