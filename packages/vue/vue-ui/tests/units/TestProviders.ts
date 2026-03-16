import { defineComponent, h } from 'vue';
import { WalletProvider } from './WalletProvider.js';

export const Providers = defineComponent({
    name: 'Providers',
    props: {
        adapters: { type: Array },
        autoConnect: { type: Boolean, default: true },
    },
    setup(props, { slots }) {
        return () => h(WalletProvider, { ...props }, slots);
    },
});

export const NoAutoConnectProviders = defineComponent({
    name: 'NoAutoConnectProviders',
    props: {
        adapters: { type: Array },
    },
    setup(props, { slots }) {
        return () => h(WalletProvider, { ...props, autoConnect: false }, slots);
    },
});
