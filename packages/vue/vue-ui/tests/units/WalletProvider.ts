import { defineComponent, h } from 'vue';
import { WalletProvider as OriginalWalletProvider } from '@tronweb3/tronwallet-adapter-vue-hooks';
import { WalletModalProvider } from '../../src/WalletModalProvider.js';
import { TronLinkAdapter } from '@tronweb3/tronwallet-adapter-tronlink';

export const NewWalletProvider = defineComponent({
    name: 'WalletProvider',
    props: {
        adapters: {
            type: Array,
            default: () => [new TronLinkAdapter({ checkTimeout: 20 })],
        },
        autoConnect: {
            type: Boolean,
            default: true,
        },
        localStorageKey: {
            type: String,
        },
        disableAutoConnectOnLoad: {
            type: Boolean,
        },
    },
    setup(props, { slots }) {
        return () =>
            h(
                OriginalWalletProvider as any,
                {
                    ...props,
                },
                {
                    default: () =>
                        h(
                            WalletModalProvider,
                            {},
                            {
                                default: () => slots.default?.(),
                            }
                        ),
                }
            );
    },
});

export const WalletProvider = NewWalletProvider;
