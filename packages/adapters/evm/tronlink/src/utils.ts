import type { EIP1193Provider } from '@tronweb3/abstract-adapter-evm';

export function getTronLinkEvmProvider(): null | EIP1193Provider {
    const context = window as Window & {
        TronLinkEVM?: EIP1193Provider;
        ethereum?: EIP1193Provider & { providers?: EIP1193Provider[] };
    };
    const providers = [context.TronLinkEVM, context.ethereum, ...(context.ethereum?.providers || [])].filter(
        Boolean
    ) as EIP1193Provider[];

    return providers.find((provider) => (provider as any).isTronLink) || null;
}
