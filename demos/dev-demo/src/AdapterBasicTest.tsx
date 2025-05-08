import type { SelectChangeEvent } from '@mui/material';
import { Alert, Box, Button, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import type { Adapter, Network } from '@tronweb3/tronwallet-abstract-adapter';
import { AdapterState, WalletReadyState } from '@tronweb3/tronwallet-abstract-adapter';
import { useLocalStorage } from '@tronweb3/tronwallet-adapter-react-hooks';
import {
    BitKeepAdapter,
    GateWalletAdapter,
    ImTokenAdapter,
    LedgerAdapter,
    OkxWalletAdapter,
    TokenPocketAdapter,
    TronLinkAdapter,
    WalletConnectAdapter,
    FoxWalletAdapter,
    BybitWalletAdapter,
    TomoWalletAdapter
} from '@tronweb3/tronwallet-adapters';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { tronWeb } from './tronweb';
import { walletconnectConfig } from './config';
const receiver = 'TMDKznuDWaZwfZHcM61FVFstyYNmK6Njk1';

export const AdapterBasicTest = memo(function AdapterBasicTest() {
    const adapters = useMemo(
        () => [
            new TomoWalletAdapter(),
            new TronLinkAdapter(),
            new TokenPocketAdapter(),
            new OkxWalletAdapter(),
            new BitKeepAdapter(),
            new GateWalletAdapter(),
            new ImTokenAdapter(),
            new FoxWalletAdapter(),
            new BybitWalletAdapter(),
            new LedgerAdapter(),
            new WalletConnectAdapter(walletconnectConfig),
        ],
        []
    );
    const [selectedName, setSelectedName] = useLocalStorage('SelectedAdapter', 'TronLink');
    const [connectState, setConnectState] = useState(AdapterState.NotFound);
    const [account, setAccount] = useState('');
    const [readyState, setReadyState] = useState(WalletReadyState.Loading);
    const [chainId, setChainId] = useState<string>('');

    function handleChange(event: SelectChangeEvent<string>) {
        setSelectedName(event.target.value);
    }
    const adapter = useMemo(() => adapters.find((adapter) => adapter.name === selectedName) || adapters[0], [selectedName, adapters]);
    const log = useCallback(
        function (...args: unknown[]) {
            console.log(`[${selectedName} Adapter] `, ...args);
        },
        [selectedName]
    );
    useEffect(() => {
        setConnectState(adapter.state);
        setAccount(adapter.address || '');
        setReadyState(adapter.readyState);
        if (adapter.connected) {
            adapter
                // @ts-ignore
                .network()
                .then((res: Network) => {
                    log('network()', res);
                    setChainId(res.chainId);
                })
                .catch((e: Error) => {
                    console.error('network() error:', e);
                });
        }

        adapter.on('readyStateChanged', () => {
            log('readyStateChanged: ', adapter.readyState);
            setReadyState(adapter.readyState);
        });
        adapter.on('connect', async () => {
            log('connect: ', adapter.address);
            setAccount(adapter.address || '');
            if (typeof (adapter as any).network === 'function') {
                adapter
                    // @ts-ignore
                    .network()
                    .then((res: Network) => {
                        log('network()', res);
                        setChainId(res.chainId);
                    })
                    .catch((e: Error) => {
                        console.error('network() error:', e);
                    });
            }
        });
        adapter.on('stateChanged', (state) => {
            log('stateChanged: ', state);
            setConnectState(state);
        });
        adapter.on('accountsChanged', (data, preaddr) => {
            log('accountsChanged: current', data, ' pre: ', preaddr);
            setAccount(data as string);
        });

        adapter.on('chainChanged', (data) => {
            log('chainChanged: ', data);
            setChainId((data as any).chainId);
        });

        adapter.on('disconnect', () => {
            log('disconnect');
            setAccount(adapter.address || '');
        });

        return () => {
            adapter.removeAllListeners();
        };
    }, [adapter, log]);

    const Items = useMemo(
        () =>
            adapters.map((adapter) => (
                <MenuItem value={adapter.name} key={adapter.name}>
                    <Stack spacing={2}>
                        <img src={adapter.icon} alt={adapter.name} style={{ width: 20, height: 20, marginRight: 8 }} />
                        {adapter.name}
                    </Stack>
                </MenuItem>
            )),
        [adapters]
    );
    return (
        <Box>
            <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                <Typography gutterBottom>Select the Adapter:</Typography>
                <Select style={{ marginLeft: 15 }} size="small" value={selectedName} onChange={handleChange}>
                    {Items}
                </Select>
            </Box>
            <InfoShow label="Selected wallet readyState:" value={readyState} />
            <InfoShow label="Current connection status:" value={connectState} />
            <InfoShow label="Connected account address:" value={account} />
            <InfoShow label="Current network you choose:" value={chainId} />
            <SectionConnect adapter={adapter} readyState={readyState} />
            <SectionSign adapter={adapter} connectState={connectState} />
            <SectionSwitchChain adapter={adapter} />
        </Box>
    );
});

function InfoShow({ label, value }: { label: string; value: string }) {
    return (
        <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', margin: '10px 0' }}>
            <Typography gutterBottom style={{ width: 250 }}>
                {label}
            </Typography>
            <Typography gutterBottom>{value}</Typography>
        </Box>
    );
}

const SectionConnect = memo(function SectionConnect({ adapter, readyState }: { adapter: Adapter; readyState: WalletReadyState }) {
    async function onConnect() {
        await adapter.connect();
    }

    return (
        <Box>
            <Button variant="contained" onClick={onConnect}>
                Connect
            </Button>

            <Button variant="contained" onClick={() => adapter?.disconnect()}>
                Disconnect
            </Button>
        </Box>
    );
});

const SectionSign = memo(function SectionSign({ adapter, connectState }: { adapter: Adapter; connectState: AdapterState }) {
    const [open, setOpen] = useState(false);
    const [signMessage, setSignMessage] = useState('Hello, Adapter');
    const [signedMessage, setSignedMessage] = useState('');

    async function onSignTransaction() {
        const transaction = await tronWeb.transactionBuilder.sendTrx(receiver, tronWeb.toSun(0.000001) as unknown as number, adapter.address!);
        const signedTransaction = await adapter.signTransaction(transaction);
        // const signedTransaction = await tronWeb.trx.sign(transaction);
        const res = await tronWeb.trx.sendRawTransaction(signedTransaction);
        setOpen(true);
    }

    const onSignMessage = useCallback(
        async function () {
            const res = await adapter.signMessage(signMessage);
            setSignedMessage(res);
        },
        [adapter, signMessage, setSignedMessage]
    );

    const onVerifyMessage = useCallback(
        async function () {
            const address = await tronWeb.trx.verifyMessageV2(signMessage, signedMessage);
            alert(address === adapter.address ? 'success verify' : 'failed verify');
        },
        [signMessage, signedMessage, adapter]
    );

    return (
        <Box margin={'20px 0'}>
            <Typography variant="h5" gutterBottom>
                Sign Usage
            </Typography>
            <TextField label="Message to sign" size="small" value={signMessage} onChange={(e) => setSignMessage(e.target.value)} />

            <Button variant="contained" disabled={connectState !== AdapterState.Connected} onClick={onSignTransaction}>
                Transfer
            </Button>
            <Button variant="contained" disabled={connectState !== AdapterState.Connected} onClick={onSignMessage}>
                Sign Message
            </Button>

            <Button variant="contained" disabled={!signedMessage} onClick={onVerifyMessage}>
                Verify Signed Message
            </Button>
            {open && (
                <Alert onClose={() => setOpen(false)} severity="success" sx={{ width: '100%', marginTop: 1 }}>
                    Success! You can confirm your transfer on{' '}
                    <a target="_blank" rel="noreferrer" href={`https://nile.tronscan.org/#/address/${adapter.address}`}>
                        Tron Scan
                    </a>
                </Alert>
            )}
        </Box>
    );
});


const SectionSwitchChain = memo(function SectionSwitchChain({ adapter }: { adapter: Adapter }) {
    const [selectedChainId, setSelectedChainId] = useState('0xcd8690dc');
    function onSwitchChain() {
        adapter.switchChain(selectedChainId);
    }
    return (
        <Box margin={'20px 0'}>
            <Typography variant="h5" gutterBottom>
                Switch Chain
            </Typography>
            <Typography variant="h6" gutterBottom>
                You can switch chain by click the button.
            </Typography>
            <Select
                labelId="demo-simple-select-label"
                id="demo-simple-select"
                value={selectedChainId}
                size="small"
                onChange={(e) => setSelectedChainId(e.target.value)}
            >
                <MenuItem value={'0x2b6653dc'}>Mainnet</MenuItem>
                <MenuItem value={'0x94a9059e'}>Shasta</MenuItem>
                <MenuItem value={'0xcd8690dc'}>Nile</MenuItem>
            </Select>

            <Button style={{ margin: '0 20px' }} onClick={onSwitchChain} variant="contained">
                Switch Chain to {selectedChainId}
            </Button>
        </Box>
    );
});
