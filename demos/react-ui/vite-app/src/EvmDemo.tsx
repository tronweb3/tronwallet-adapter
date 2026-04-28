import { useState, useMemo, useEffect, useCallback } from 'react';
import { OkxWalletEvmAdapter } from '@tronweb3/tronwallet-adapter-okxwallet-evm';
import { MetaMaskEvmAdapter } from '@tronweb3/tronwallet-adapter-metamask-evm';
import type { Adapter } from '@tronweb3/abstract-adapter-evm';
import { Button } from '@tronweb3/tronwallet-adapter-react-ui';

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
        <div style={{ marginBottom: 200 }}>
            <h2>EVM Wallet Adapter Demo</h2>
            <p>
                <span>Select EVM Wallet:</span>
                <select value={selectedName} onChange={(e) => setSelectedName(e.target.value)}>
                    {adapters.map((a) => (
                        <option key={a.name} value={a.name}>
                            {a.name}
                        </option>
                    ))}
                </select>
            </p>
            <p>
                <span>Ready State:</span> {readyState}
            </p>
            <p>
                <span>Address:</span> {account || 'Not connected'}
            </p>
            <div>
                <Button style={{ marginRight: '20px', marginBottom: '10px' }} onClick={onConnect} disabled={!!account}>
                    Connect
                </Button>
                <Button
                    style={{ marginRight: '20px', marginBottom: '10px' }}
                    onClick={onSignMessage}
                    disabled={!account}
                >
                    SignMessage
                </Button>
            </div>
        </div>
    );
}
