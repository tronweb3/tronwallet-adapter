import { NetworkType } from '@tronweb3/tronwallet-abstract-adapter';
import { Scope } from './types.js';

/**
 * Converts a chain ID to its corresponding Tron scope.
 * @param chainId - The chain ID string.
 * @returns The corresponding TronScope.
 * @throws Error if the chain ID is unsupported.
 */
export function chainIdToScope(chainId: string): Scope {
    switch (chainId) {
        case '0x2b6653dc': // Tron mainnet
            return Scope.MAINNET;
        case '0xcd8690dc': // Tron nile testnet
            return Scope.NILE;
        case '0x94a9059e': // Tron shasta testnet
            return Scope.SHASTA;
        default:
            throw new Error(`Could not determine scope for unsupported chainId: ${chainId}`);
    }
}

/**
 * Converts a Tron scope to its corresponding chain ID.
 * @param scope - The TronScope.
 * @returns The corresponding chain ID string.
 * @throws Error if the scope is unsupported.
 */
export function scopeToChainId(scope: Scope): string {
    switch (scope) {
        case Scope.MAINNET:
            return '0x2b6653dc';
        case Scope.NILE:
            return '0xcd8690dc';
        case Scope.SHASTA:
            return '0x94a9059e';
        default:
            throw new Error(`Could not determine chainId for unsupported scope: ${scope}`);
    }
}

/**
 * Extracts the address from a CAIP account ID.
 * @param caipAccountId - The CAIP account ID string (e.g., 'tron:mainnet:address').
 * @returns The extracted address.
 * @throws Error if the CAIP account ID is invalid.
 */
export function getAddressFromCaipAccountId(caipAccountId: string): string {
    const [, , address] = caipAccountId.split(':');
    if (!address) {
        throw new Error(`Invalid CAIP account ID: ${caipAccountId}`);
    }
    return address;
}

/**
 * Checks if the given data represents an accountsChanged event.
 * @param data - The event data.
 * @returns True if it's an accountsChanged event, false otherwise.
 */
export function isAccountChangedEvent(event: any): boolean {
    return event?.method === 'wallet_notify' && event?.params?.notification?.method === 'metamask_accountsChanged';
}

export function isSessionChangedEvent(event: any): boolean {
    return event?.method === 'wallet_sessionChanged';
}

/**
 * Converts a Tron scope to its corresponding NetworkType.
 * @param scope - The Tron scope string.
 * @returns The corresponding NetworkType.
 * @throws Error if the scope is unsupported.
 */
export function scopeToNetworkType(scope: Scope): NetworkType {
    switch (scope) {
        case Scope.MAINNET:
            return NetworkType.Mainnet;
        case Scope.NILE:
            return NetworkType.Nile;
        case Scope.SHASTA:
            return NetworkType.Shasta;
        default:
            throw new Error(`Could not determine network type for unsupported scope: ${scope}`);
    }
}
