import type { RpcMethod } from '@metamask/multichain-api-client';
import type { SignedTransaction, Transaction } from '@tronweb3/tronwallet-abstract-adapter';

/**
 * Defines the RPC methods and events for Tron blockchain interactions.
 */
export type TronRpc = {
    methods: {
        signMessage: RpcMethod<{ message: string; privateKey?: string }, { signature: string }>;
        signTransaction: RpcMethod<
            { transaction: Transaction; privateKey?: string },
            { signedTransaction: SignedTransaction }
        >;
    };
    events: [];
};

/**
 * Enum of supported Tron network scopes in CAIP-2 format.
 */
export enum Scope {
    MAINNET = 'tron:728126428',
    SHASTA = 'tron:2494104990',
    NILE = 'tron:3448148188',
}

export type ScopeValue = `${Scope}`;
