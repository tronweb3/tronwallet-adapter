import { WalletSignTypedDataError } from './errors.js';
import type { TypedData } from './types.js';

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validate a TypedData payload and return a normalized copy safe to pass to wallets.
 *
 * Current normalization: convert `domain.chainId` from string to number (some wallets,
 * e.g. TronLink, require a numeric chainId).
 *
 * Throws {@link WalletSignTypedDataError} if the payload is not a valid TypedData object.
 */
export function normalizeAndValidateTypedData(typedData: TypedData): TypedData {
    if (!isPlainObject(typedData)) {
        throw new WalletSignTypedDataError('typedData must be an object.');
    }
    if (!isPlainObject(typedData.domain)) {
        throw new WalletSignTypedDataError('typedData.domain must be an object.');
    }
    if (!isPlainObject(typedData.types)) {
        throw new WalletSignTypedDataError('typedData.types must be an object.');
    }
    if (!isPlainObject(typedData.message)) {
        throw new WalletSignTypedDataError('typedData.message must be an object.');
    }

    const { chainId } = typedData.domain;
    if (typeof chainId === 'string') {
        const parsed = Number(chainId);
        if (!Number.isFinite(parsed)) {
            throw new WalletSignTypedDataError(`Invalid domain.chainId: ${chainId}.`);
        }
        return {
            ...typedData,
            domain: { ...typedData.domain, chainId: parsed },
        };
    }

    return typedData;
}
