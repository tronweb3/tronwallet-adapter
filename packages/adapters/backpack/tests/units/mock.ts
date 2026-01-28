// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { BackpackTronProvider } from '../../src/utils.js';

export class MockBackpackProvider implements BackpackTronProvider {
    isBackpack = true;
    private _address = '';
    private _connected = false;
    private _listeners: Record<string, ((...args: unknown[]) => unknown)[]> = {};

    constructor(address?: string) {
        if (address) {
            this._address = address;
            this._connected = true;
        }
    }

    async request(args: { method: string; params?: unknown }): Promise<unknown> {
        switch (args.method) {
            case 'tron_accounts':
                return this._connected && this._address ? [this._address] : [];
            case 'tron_requestAccounts':
                if (!this._connected) {
                    throw { code: 4001, message: 'User rejected' };
                }
                return this._address ? [this._address] : [];
            case 'tron_signMessage':
                if (!this._connected) throw new Error('Not connected');
                return 'signed_message_result';
            case 'tron_signTransaction':
                if (!this._connected) throw new Error('Not connected');
                return { txID: 'test_tx_id', signature: ['test_signature'] };
            case 'eth_chainId':
                return '0x2b6653dc';
            case 'wallet_switchEthereumChain':
                return null;
            default:
                throw new Error(`Unknown method: ${args.method}`);
        }
    }

    on(event: string, handler: (...args: unknown[]) => void): void {
        if (!this._listeners[event]) {
            this._listeners[event] = [];
        }
        this._listeners[event].push(handler);
    }

    removeListener(event: string, handler: (...args: unknown[]) => void): void {
        if (this._listeners[event]) {
            const idx = this._listeners[event].indexOf(handler);
            if (idx !== -1) {
                this._listeners[event].splice(idx, 1);
            }
        }
    }

    async connect(): Promise<void> {
        this._connected = true;
    }

    async disconnect(): Promise<void> {
        this._connected = false;
        this._address = '';
    }

    // Test helpers
    _setAddress(address: string): void {
        this._address = address;
    }

    _setConnected(connected: boolean): void {
        this._connected = connected;
    }

    _emit(event: string, ...args: unknown[]): void {
        if (this._listeners[event]) {
            this._listeners[event].forEach((handler) => handler(...args));
        }
    }

    _getListenerCount(event: string): number {
        return this._listeners[event]?.length || 0;
    }
}

export function installMockBackpack(address?: string): MockBackpackProvider {
    const provider = new MockBackpackProvider(address);
    (window as any).backpack = { tron: provider };
    return provider;
}

export function uninstallMockBackpack(): void {
    (window as any).backpack = undefined;
    (window as any).tron = undefined;
}
