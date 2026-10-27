import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { Adapter, AdapterState, WalletReadyState, WalletError } from '../../src/index.js';

class TestAdapter extends Adapter<'Test'> {
    name = 'Test' as any;
    url = '';
    icon = '';
    readyState: WalletReadyState = WalletReadyState.Found;
    state: AdapterState = AdapterState.Disconnect;
    address: string | null = null;
    connecting = false;
    async connect(): Promise<void> {}
    async signMessage(_m: string): Promise<string> {
        return 'msg';
    }
    async signTransaction(_t: any): Promise<any> {
        return { signature: 'sig' };
    }
}

describe('Adapter default methods', () => {
    let originalInfo: any;
    beforeEach(() => {
        originalInfo = console.info;
        console.info = vi.fn();
    });
    afterEach(() => {
        console.info = originalInfo;
    });

    test('connected reflects the state getter', () => {
        const a = new TestAdapter();
        a.state = AdapterState.Disconnect;
        expect(a.connected).toBe(false);
        a.state = AdapterState.Connected;
        expect(a.connected).toBe(true);
    });

    test('disconnect() logs and resolves', async () => {
        const a = new TestAdapter();
        await expect(a.disconnect()).resolves.toBeUndefined();
        expect(console.info).toHaveBeenCalled();
    });

    test('multiSign() rejects with the default message', async () => {
        const a = new TestAdapter();
        await expect(a.multiSign({} as any)).rejects.toBe("The current wallet doesn't support multiSign.");
    });

    test('switchChain() rejects with the default message', async () => {
        const a = new TestAdapter();
        await expect(a.switchChain('0x1')).rejects.toBe("The current wallet doesn't support switch chain.");
    });

    test('signTypedData() rejects when the typed data is invalid', async () => {
        const a = new TestAdapter();
        await expect(a.signTypedData({} as any)).rejects.toBeInstanceOf(WalletError);
    });

    test('signTypedData() rejects through _signTypedData when the typed data is valid', async () => {
        const a = new TestAdapter();
        const typedData = {
            domain: { name: 'x' },
            primaryType: 'T',
            types: { T: [{ name: 'v', type: 'string' }] },
            message: { v: 'm' },
        } as any;
        await expect(a.signTypedData(typedData)).rejects.toBe("The current wallet doesn't support signTypedData.");
    });
});
