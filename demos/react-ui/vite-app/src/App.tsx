import React, { useMemo, useState } from 'react';
import type { Adapter, WalletError } from '@tronweb3/tronwallet-abstract-adapter';
import { WalletDisconnectedError, WalletNotFoundError } from '@tronweb3/tronwallet-abstract-adapter';
import { useWallet, WalletProvider } from '@tronweb3/tronwallet-adapter-react-hooks';
import {
    WalletActionButton,
    WalletConnectButton,
    WalletDisconnectButton,
    WalletModalProvider,
    WalletSelectButton,
} from '@tronweb3/tronwallet-adapter-react-ui';
import toast from 'react-hot-toast';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Alert } from '@mui/material';
import { TronLinkAdapter, TokenPocketAdapter, BitKeepAdapter, OkxWalletAdapter, GateWalletAdapter, BybitWalletAdapter, LedgerAdapter, WalletConnectAdapter } from '@tronweb3/tronwallet-adapters';
import { tronWeb } from './tronweb';
import { Button } from '@tronweb3/tronwallet-adapter-react-ui';
const rows = [
    { name: 'Connect Button', reactUI: WalletConnectButton },
    { name: 'Disconnect Button', reactUI: WalletDisconnectButton },
    { name: 'Select Wallet Button', reactUI: WalletSelectButton },
    { name: 'Multi Action Button', reactUI: WalletActionButton },
];
/**
 * wrap your app content with WalletProvider and WalletModalProvider
 * WalletProvider provide some useful properties and methods
 * WalletModalProvider provide a Modal in which you can select wallet you want use.
 *
 * Also you can provide a onError callback to process any error such as ConnectionError
 */
export function App() {
    function onError(e: WalletError) {
        console.log(e);
        if (e instanceof WalletNotFoundError) {
            toast.error(e.message);
        } else if (e instanceof WalletDisconnectedError) {
            toast.error(e.message);
        } else toast.error(e.message);
    }
    const adapters = useMemo(function () {
        const tronLink1 = new TronLinkAdapter();
        const walletConnect1 = new WalletConnectAdapter({
            network: 'Nile',
            options: {
                relayUrl: 'wss://relay.walletconnect.com',
                // example WC app project ID
                projectId: '5fc507d8fc7ae913fff0b8071c7df231',
                metadata: {
                    name: 'Test DApp',
                    description: 'JustLend WalletConnect',
                    url: 'https://your-dapp-url.org/',
                    icons: ['https://your-dapp-url.org/mainLogo.svg'],
                },
            },
            web3ModalConfig: {
                themeMode: 'dark',
                themeVariables: {
                    '--wcm-z-index': '1000'
                },
                // explorerRecommendedWalletIds: 'NONE',
                enableExplorer: true,
                explorerRecommendedWalletIds: [
                    '225affb176778569276e484e1b92637ad061b01e13a048b35a9d280c3b58970f',
                    '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369',
                    '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0'
                ]
                // mobileWallets: [],
                // desktopWallets: []
                // explorerExcludedWalletIds: [
                //   '225affb176778569276e484e1b92637ad061b01e13a048b35a9d280c3b58970f',
                //   '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369',
                //   '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0',
                //   '802a2041afdaf4c7e41a2903e98df333c8835897532699ad370f829390c6900f',
                //   'ecc4036f814562b41a5268adc86270fba1365471402006302e70169465b7ac18',
                //   '19177a98252e07ddfc9af2083ba8e07ef627cb6103467ffebb3f8f4205fd7927',
                //   '6464873279d46030c0b6b005b33da6be5ed57a752be3ef1f857dc10eaf8028aa',
                //   '2c81da3add65899baeac53758a07e652eea46dbb5195b8074772c62a77bbf568'
                // ]
            }
        });
        const ledger = new LedgerAdapter({
            accountNumber: 2,
        });
        const tokenPocket = new TokenPocketAdapter();
        const bitKeep = new BitKeepAdapter();
        const okxWalletAdapter = new OkxWalletAdapter();
        const gateAdapter = new GateWalletAdapter();
        const bybitAdapter = new BybitWalletAdapter();
        return [tronLink1, walletConnect1, ledger, tokenPocket, bitKeep, okxWalletAdapter, gateAdapter, bybitAdapter];
    }, []);
    function onConnect() {
        console.log('onConnect');
    }
    async function onAccountsChanged() {
        console.log('onAccountsChanged')
    }
    async function onAdapterChanged(adapter: Adapter | null) {
        console.log('onAdapterChanged', adapter)
    }
    return (
        <WalletProvider onError={onError} onConnect={onConnect} onAccountsChanged={onAccountsChanged} onAdapterChanged={onAdapterChanged} autoConnect={true} adapters={adapters} disableAutoConnectOnLoad={true}>
            <WalletModalProvider>
                <UIComponent></UIComponent>
                <Profile></Profile>
                <SignDemo></SignDemo>
            </WalletModalProvider>
        </WalletProvider>
    );
}

function UIComponent() {
    return (
        <div>
            <h2>UI Component</h2>
            <TableContainer style={{ overflow: 'visible' }} component="div">
                <Table sx={{}} aria-label="simple table">
                    <TableHead>
                        <TableRow sx={{ 'th': { padding: '5px' } }}>
                            <TableCell>Component</TableCell>
                            <TableCell align="left">React UI</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {rows.map((row) => (
                            <TableRow key={row.name} sx={{ '&:last-child td, &:last-child th': { border: 0 }, 'td, th': { padding: '5px' } }}>
                                <TableCell component="th" scope="row">
                                    {row.name}
                                </TableCell>
                                <TableCell align="left">
                                    <row.reactUI></row.reactUI>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </div>
    );
}

function Profile() {
    const { address, connected, wallet } = useWallet();
    return (
        <div>
            <h2>Wallet Connection Info</h2>
            <p>
                <span>Connection Status:</span> {connected ? 'Connected' : 'Disconnected'}
            </p>
            <p>
                <span>Your selected Wallet:</span> {wallet?.adapter.name}
            </p>
            <p>
                <span>Your Address:</span> {address}
            </p>
        </div>
    );
}

function SignDemo() {
    const { signMessage, signTransaction, address } = useWallet();
    const [message, setMessage] = useState('');
    const [signedMessage, setSignedMessage] = useState('');
    const receiver = 'TMDKznuDWaZwfZHcM61FVFstyYNmK6Njk1';
    const [open, setOpen] = useState(false);

    async function onSignMessage() {
        const res = await signMessage(message);
        setSignedMessage(res);
    }

    async function onSignTransaction() {
        const transaction = await tronWeb.transactionBuilder.sendTrx(receiver, +tronWeb.toSun(0.001), address || '');
        const signedTransaction = await signTransaction(transaction);
        // const signedTransaction = await tronWeb.trx.sign(transaction);
        const res = await tronWeb.trx.sendRawTransaction(signedTransaction);
        setOpen(true);
    }
    return (
        <div style={{ marginBottom: 200 }}>
            <h2>Sign a message</h2>
            <p style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', wordBreak: 'break-all' }}>
                You can sign a message by click the button.
            </p>
            <Button style={{ marginRight: '20px', marginBottom: '10px' }} onClick={onSignMessage}>
                SignMessage
            </Button>
            <TextField
                size="small"
                onChange={(e) => setMessage(e.target.value)}
                placeholder="input message to signed"
            ></TextField>
            {!!signedMessage && <p><span>Your sigedMessage is:</span> <span>{signedMessage}</span>  </p>}
            <h2>Sign a Transaction</h2>
            <p style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', wordBreak: 'break-all' }}>
                You can transfer 0.001 Trx to &nbsp;{receiver}&nbsp;by click the button.
            </p>
            <Button onClick={onSignTransaction}>Transfer</Button>
            {open && (
                <Alert onClose={() => setOpen(false)} severity="success" sx={{ width: '100%', marginTop: 1 }}>
                    Success! You can confirm your transfer on{' '}
                    <a target="_blank" rel="noreferrer" href={`https://nile.tronscan.org/#/address/${address}`}>
                        Tron Scan
                    </a>
                </Alert>
            )}
        </div>
    );
}
