'use client';
import '../styles/globals.css';
import type { AppProps } from 'next/app';
import type { Adapter, WalletError } from '@tronweb3/tronwallet-abstract-adapter';
import { WalletDisconnectedError, WalletNotFoundError } from '@tronweb3/tronwallet-abstract-adapter';
// @ts-ignore
import { toast } from 'react-hot-toast';
import { useEffect, useState } from 'react';
import { WalletProvider } from '@tronweb3/tronwallet-adapter-react-hooks';
import { WalletModalProvider } from '@tronweb3/tronwallet-adapter-react-ui';
import '@tronweb3/tronwallet-adapter-react-ui/style.css';
export default function App({ Component, pageProps }: AppProps) {
    function onError(e: WalletError) {
        if (e instanceof WalletNotFoundError) {
            toast.error(e.message);
        } else if (e instanceof WalletDisconnectedError) {
            toast.error(e.message);
        } else toast.error(e.message);
    }
    const [adapters, setAdapters] = useState<Adapter[]>([]);
    useEffect(() => {
        import('@tronweb3/tronwallet-adapters').then((res) => {
            const { WalletConnectAdapter } = res;
            const walletConnectAdapter = new WalletConnectAdapter({
                network: 'Nile',
                options: {
                    relayUrl: process.env.NEXT_PUBLIC_WALLETCONNECT_RELAY_URL,
                    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
                    metadata: {
                        name: 'Test DApp',
                        description: 'Test dApp',
                        url: 'https://your-dapp-url.org/',
                        icons: ['https://your-dapp-url.org/mainLogo.svg'],
                    },
                },
                web3ModalConfig: {
                    themeMode: 'dark',
                    themeVariables: {
                        '--wcm-z-index': '1000',
                    },
                },
            });
            setAdapters([
                walletConnectAdapter,
                ...Object.entries(res)
                    .filter(
                        ([key]) =>
                            key.endsWith('Adapter') && !key.endsWith('EvmAdapter') && !key.includes('WalletConnect')
                    )
                    .map(([key, value]) => new (value as any)()),
            ]);
        });
    }, [setAdapters]);

    /**
     * wrap your app content with WalletProvider and WalletModalProvider
     * WalletProvider provide some useful properties and methods
     * WalletModalProvider provide a Modal in which you can select wallet you want use.
     *
     * Also you can provide a onError callback to process any error such as ConnectionError
     */
    return (
        <WalletProvider onError={onError} adapters={adapters} disableAutoConnectOnLoad={true}>
            <WalletModalProvider>
                <Component {...pageProps} />
            </WalletModalProvider>
        </WalletProvider>
    );
}
