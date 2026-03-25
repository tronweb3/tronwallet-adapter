import React from 'react';
import type { FC, PropsWithChildren } from 'react';
import { WalletProvider } from '@tronweb3/tronwallet-adapter-react-hooks';
import { WalletModalProvider } from '../../src/WalletModalProvider.js';
import { TronLinkAdapter } from '@tronweb3/tronwallet-adapter-tronlink';

export const Providers: FC<PropsWithChildren> = function (props) {
    return (
        <WalletProvider adapters={[new TronLinkAdapter({ checkTimeout: 20 })]}>
            <WalletModalProvider>{props.children}</WalletModalProvider>
        </WalletProvider>
    );
};

export const NoAutoConnectProviders: FC<PropsWithChildren> = function (props) {
    return (
        <WalletProvider adapters={[new TronLinkAdapter({ checkTimeout: 20 })]} autoConnect={false}>
            <WalletModalProvider>{props.children}</WalletModalProvider>
        </WalletProvider>
    );
};
