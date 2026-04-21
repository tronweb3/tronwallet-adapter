import EventEmitter from 'eventemitter3';
import type { WalletError } from './errors.js';
import { normalizeAndValidateTypedData } from './typedData.js';
import type { SignedTransaction, Transaction, TypedData } from './types.js';

export { EventEmitter };

export interface AdapterEvents {
    connect(address: string): void;
    disconnect(): void;
    error(error: WalletError): void;
    readyStateChanged(state: WalletReadyState): void;
    stateChanged(state: AdapterState): void;
    accountsChanged(address: string, preAddr: string): void;
    chainChanged(chainData: unknown): void;
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
/**
 * Wallet ready state.
 */
export enum WalletReadyState {
    /**
     * Adapter will start to check if wallet exists after adapter instance is created.
     */
    Loading = 'Loading',
    /**
     * When checking ends and wallet is not found, readyState will be NotFound.
     */
    NotFound = 'NotFound',
    /**
     * When checking ends and wallet is found, readyState will be Found.
     */
    Found = 'Found',
}
/**
 * Adapter state
 */
export enum AdapterState {
    /**
     * If adapter is checking the wallet, the state is Loading.
     */
    Loading = 'Loading',
    /**
     * If wallet is not installed, the state is NotFound.
     */
    NotFound = 'NotFound',
    /**
     * If wallet is installed but is not connected to current Dapp, the state is Disconnected.
     */
    Disconnect = 'Disconnected',
    /**
     * Wallet is connected to current Dapp.
     */
    Connected = 'Connected',
}
export interface BaseAdapterConfig {
    /**
     * Set if open Wallet's website url when wallet is not installed.
     * Default is true.
     */
    openUrlWhenWalletNotFound?: boolean;
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
