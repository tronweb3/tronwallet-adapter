import { useState, useMemo, useEffect, useCallback } from 'react';
import { OkxWalletEvmAdapter } from '@tronweb3/tronwallet-adapter-okxwallet-evm';
import { MetaMaskEvmAdapter } from '@tronweb3/tronwallet-adapter-metamask-evm';
import type { Adapter } from '@tronweb3/abstract-adapter-evm';

export function EvmDemo() {
    const adapters = useMemo(() => [new OkxWalletEvmAdapter(), new MetaMaskEvmAdapter()], []);
    const [selectedName, setSelectedName] = useState('OKX Wallet');
    const adapter = useMemo(
        () => adapters.find((a) => a.name === selectedName) || adapters[0],
        [selectedName, adapters]
    );
    const [account, setAccount] = useState('');
    const [readyState, setReadyState] = useState(adapter.readyState);

    useEffect(() => {
        setAccount(adapter.address || '');
        setReadyState(adapter.readyState);

        const onReadyStateChanged = () => setReadyState(adapter.readyState);
        const onAccountsChanged = (accounts: string[]) => setAccount(accounts?.[0] || '');
        const onDisconnect = () => setAccount('');

        adapter.on('readyStateChanged', onReadyStateChanged);
        adapter.on('accountsChanged', onAccountsChanged);
        adapter.on('disconnect', onDisconnect);

        return () => {
            adapter.removeAllListeners();
        };
    }, [adapter]);

    const onConnect = useCallback(async () => {
        const address = await adapter.connect();
        setAccount(address);
    }, [adapter]);

    const onSignMessage = useCallback(async () => {
        const res = await adapter.signMessage({ message: 'Hello from React UI Demo' });
        console.log('[EVM] Signed message:', res);
        alert('Signed: ' + res.slice(0, 20) + '...');
    }, [adapter]);

    return (
        <div style={{ marginTop: 40, padding: 20, border: '1px solid #ccc', borderRadius: 8 }}>
            <h2>EVM Wallet Adapter Demo</h2>
            <div style={{ marginBottom: 12 }}>
                <label>Select EVM Wallet: </label>
                <select value={selectedName} onChange={(e) => setSelectedName(e.target.value)}>
                    {adapters.map((a) => (
                        <option key={a.name} value={a.name}>
                            {a.name}
                        </option>
                    ))}
                </select>
            </div>
            <p>
                <strong>Ready State:</strong> {readyState}
            </p>
            <p>
                <strong>Address:</strong> {account || 'Not connected'}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={onConnect} disabled={!!account}>
                    Connect
                </button>
                <button onClick={onSignMessage} disabled={!account}>
                    Sign Message
                </button>
            </div>
        </div>
    );
}
