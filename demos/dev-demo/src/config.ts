import type { WalletConnectAdapterConfig } from '@tronweb3/tronwallet-adapters';

export const walletconnectConfig: WalletConnectAdapterConfig = {
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
            '--wcm-z-index': '1000',
        },
        // explorerRecommendedWalletIds: 'NONE',
        enableExplorer: true,
        explorerRecommendedWalletIds: [
            '225affb176778569276e484e1b92637ad061b01e13a048b35a9d280c3b58970f',
            '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369',
            '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0',
        ],
    },
};

export const CHAIN_ID = {
    Mainnet: '0x2b6653dc',
    Shasta: '0x94a9059e',
    Nile: '0xcd8690dc',
};

export const TRONSCAN_URL = {
    [CHAIN_ID.Mainnet]: 'https://tronscan.org/',
    [CHAIN_ID.Shasta]: 'https://shasta.tronscan.org/',
    [CHAIN_ID.Nile]: 'https://nile.tronscan.org/',
}
