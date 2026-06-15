import EventEmitter from 'eventemitter3';
import { normalizeAndValidateTypedData } from './typedData.js';
import type { SignedTransaction, Transaction, TypedData } from './types.js';
import { type WalletError } from './errors.js';
import type { WalletReadyState } from './types.js';
import { AdapterState } from './types.js';
import type { SecurityOptions } from './security.js';

export { EventEmitter };

export interface AdapterEvents {
    connect(address: string): void;
    disconnect(): void;
    error(error: WalletError): void;
    readyStateChanged(state: WalletReadyState): void;
    stateChanged(state: AdapterState): void;
    accountsChanged(address: string, preAddr: string): void;
    chainChanged(chainData: { chainId: string }): void;
}

export type AdapterName<T extends string = string> = T & { __brand__: 'AdapterName' };

export interface AdapterProps<Name extends string = string> {
    name: AdapterName<Name>;
    url: string;
    icon: string;
    readyState: WalletReadyState;
    state: AdapterState;
    address: string | null;
    connecting: boolean;
    connected: boolean;

    connect(options?: Record<string, unknown>): Promise<void>;
    disconnect(): Promise<void>;
    signMessage(message: string): Promise<string>;
    signTransaction(transaction: Transaction): Promise<SignedTransaction>;
    signTypedData(typedData: TypedData): Promise<string>;
    switchChain(chainId: string): Promise<void>;
}

export interface BaseAdapterConfig {
    /**
     * Set if open Wallet's website url when wallet is not installed.
     * Default is true.
     */
    openUrlWhenWalletNotFound?: boolean;
    /**
     * Timeout in millisecond for checking if BybitWallet wallet exists.
     * Default is 2 * 1000ms
     */
    checkTimeout?: number;
    /**
     * Set if open BybitWallet app using DeepLink.
     * Default is true.
     */
    openAppWithDeeplink?: boolean;
    /**
     * Set security check config.
     * @see SecurityOptions
     */
    securityOptions?: SecurityOptions;
}

export abstract class Adapter<Name extends string = string>
    extends EventEmitter<AdapterEvents>
    implements AdapterProps
{
    abstract name: AdapterName<Name>;
    abstract url: string;
    abstract icon: string;
    abstract readyState: WalletReadyState;
    abstract state: AdapterState;
    abstract address: string | null;
    abstract connecting: boolean;

    get connected() {
        return this.state === AdapterState.Connected;
    }

    abstract connect(options?: Record<string, unknown>): Promise<void>;
    /**
     * Some wallets such as TronLink don't support disconnect() method.
     */
    disconnect(): Promise<void> {
        console.info("The current adapter doesn't support disconnect by DApp.");
        return Promise.resolve();
    }
    abstract signMessage(message: string): Promise<string>;
    abstract signTransaction(transaction: Transaction): Promise<SignedTransaction>;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    multiSign(transaction: Transaction, options: { permissionId?: number } = {}): Promise<any> {
        return Promise.reject("The current wallet doesn't support multiSign.");
    }
    signTypedData(typedData: TypedData): Promise<string> {
        let normalized: TypedData;
        try {
            normalized = normalizeAndValidateTypedData(typedData);
        } catch (error) {
            return Promise.reject(error);
        }
        return this._signTypedData(normalized);
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected _signTypedData(_typedData: TypedData): Promise<string> {
        return Promise.reject("The current wallet doesn't support signTypedData.");
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    switchChain(_chainId: string): Promise<void> {
        return Promise.reject("The current wallet doesn't support switch chain.");
    }
}
