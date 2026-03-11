import { describe, it, expect } from 'vitest';
import {
    WalletError,
    WalletNotFoundError,
    WalletNotSelectedError,
    WalletDisconnectedError,
    WalletConnectionError,
    WalletDisconnectionError,
    WalletSignMessageError,
    WalletSignTransactionError,
    WalletWalletLoadError,
    WalletWindowClosedError,
    WalletSwitchChainError,
    WalletGetNetworkError,
} from '../src/errors.js';

describe('WalletError', () => {
    it('should create WalletError with message', () => {
        const message = 'Test error message';
        const error = new WalletError(message);

        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(WalletError);
        expect(error.message).toBe(message);
        expect(error.error).toBeUndefined();
    });

    it('should create WalletError with message and error object', () => {
        const message = 'Test error message';
        const originalError = new Error('Original error');
        const error = new WalletError(message, originalError);

        expect(error).toBeInstanceOf(WalletError);
        expect(error.message).toBe(message);
        expect(error.error).toBe(originalError);
    });

    it('should create WalletError without message', () => {
        const error = new WalletError();

        expect(error).toBeInstanceOf(WalletError);
        expect(error.message).toBe('');
    });

    it('should create WalletError with error object only', () => {
        const originalError = { code: 'ERR_001', description: 'Some error' };
        const error = new WalletError(undefined, originalError);

        expect(error.error).toBe(originalError);
        expect(error.message).toBe('');
    });
});

describe('WalletNotFoundError', () => {
    it('should create WalletNotFoundError with default message', () => {
        const error = new WalletNotFoundError();

        expect(error).toBeInstanceOf(WalletError);
        expect(error.name).toBe('WalletNotFoundError');
        expect(error.message).toBe('The wallet is not found.');
    });

    it('should create WalletNotFoundError with custom message', () => {
        const customMessage = 'Custom wallet not found message';
        const error = new WalletNotFoundError(customMessage);

        expect(error).toBeInstanceOf(WalletNotFoundError);
        expect(error.name).toBe('WalletNotFoundError');
        expect(error.message).toBe(customMessage);
    });

    it('should create WalletNotFoundError with message and error object', () => {
        const message = 'Wallet not found';
        const originalError = new Error('Root cause');
        const error = new WalletNotFoundError(message, originalError);

        expect(error.message).toBe(message);
        expect(error.error).toBe(originalError);
    });
});

describe('WalletNotSelectedError', () => {
    it('should create WalletNotSelectedError with default message', () => {
        const error = new WalletNotSelectedError();

        expect(error).toBeInstanceOf(WalletError);
        expect(error.name).toBe('WalletNotSelectedError');
        expect(error.message).toBe('No wallet is selected. Please select a wallet.');
    });

    it('should be instance of Error and WalletError', () => {
        const error = new WalletNotSelectedError();

        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(WalletError);
        expect(error).toBeInstanceOf(WalletNotSelectedError);
    });
});

describe('WalletDisconnectedError', () => {
    it('should create WalletDisconnectedError with default message', () => {
        const error = new WalletDisconnectedError();

        expect(error).toBeInstanceOf(WalletError);
        expect(error.name).toBe('WalletDisconnectedError');
        expect(error.message).toBe('The wallet is disconnected. Please connect first.');
    });

    it('should be instance of Error and WalletError', () => {
        const error = new WalletDisconnectedError();

        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(WalletError);
        expect(error).toBeInstanceOf(WalletDisconnectedError);
    });
});

describe('WalletConnectionError', () => {
    it('should create WalletConnectionError', () => {
        const error = new WalletConnectionError();

        expect(error).toBeInstanceOf(WalletError);
        expect(error).toBeInstanceOf(WalletConnectionError);
        expect(error.name).toBe('WalletConnectionError');
    });

    it('should create WalletConnectionError with message', () => {
        const message = 'Failed to connect to wallet';
        const error = new WalletConnectionError(message);

        expect(error).toBeInstanceOf(WalletConnectionError);
        expect(error.message).toBe(message);
        expect(error.name).toBe('WalletConnectionError');
    });

    it('should create WalletConnectionError with message and error object', () => {
        const message = 'Connection failed';
        const originalError = new Error('Network timeout');
        const error = new WalletConnectionError(message, originalError);

        expect(error.message).toBe(message);
        expect(error.error).toBe(originalError);
    });
});

describe('WalletDisconnectionError', () => {
    it('should create WalletDisconnectionError', () => {
        const error = new WalletDisconnectionError();

        expect(error).toBeInstanceOf(WalletError);
        expect(error).toBeInstanceOf(WalletDisconnectionError);
        expect(error.name).toBe('WalletDisconnectionError');
    });

    it('should create WalletDisconnectionError with message', () => {
        const message = 'Failed to disconnect from wallet';
        const error = new WalletDisconnectionError(message);

        expect(error).toBeInstanceOf(WalletDisconnectionError);
        expect(error.message).toBe(message);
    });

    it('should create WalletDisconnectionError with error object', () => {
        const originalError = new Error('Disconnection error');
        const error = new WalletDisconnectionError('Disconnect failed', originalError);

        expect(error.error).toBe(originalError);
    });
});

describe('WalletSignMessageError', () => {
    it('should create WalletSignMessageError', () => {
        const error = new WalletSignMessageError();

        expect(error).toBeInstanceOf(WalletError);
        expect(error).toBeInstanceOf(WalletSignMessageError);
        expect(error.name).toBe('WalletSignMessageError');
    });

    it('should create WalletSignMessageError with message', () => {
        const message = 'Failed to sign message';
        const error = new WalletSignMessageError(message);

        expect(error).toBeInstanceOf(WalletSignMessageError);
        expect(error.message).toBe(message);
    });

    it('should create WalletSignMessageError with message and error object', () => {
        const message = 'Sign message failed';
        const originalError = new Error('User rejected');
        const error = new WalletSignMessageError(message, originalError);

        expect(error.message).toBe(message);
        expect(error.error).toBe(originalError);
    });
});

describe('WalletSignTransactionError', () => {
    it('should create WalletSignTransactionError', () => {
        const error = new WalletSignTransactionError();

        expect(error).toBeInstanceOf(WalletError);
        expect(error).toBeInstanceOf(WalletSignTransactionError);
        expect(error.name).toBe('WalletSignTransactionError');
    });

    it('should create WalletSignTransactionError with message', () => {
        const message = 'Failed to sign transaction';
        const error = new WalletSignTransactionError(message);

        expect(error).toBeInstanceOf(WalletSignTransactionError);
        expect(error.message).toBe(message);
    });

    it('should create WalletSignTransactionError with message and error object', () => {
        const message = 'Transaction signing failed';
        const originalError = new Error('Invalid transaction');
        const error = new WalletSignTransactionError(message, originalError);

        expect(error.message).toBe(message);
        expect(error.error).toBe(originalError);
    });
});

describe('WalletWalletLoadError', () => {
    it('should create WalletWalletLoadError', () => {
        const error = new WalletWalletLoadError();

        expect(error).toBeInstanceOf(WalletError);
        expect(error).toBeInstanceOf(WalletWalletLoadError);
        expect(error.name).toBe('WalletWalletLoadError');
    });

    it('should create WalletWalletLoadError with message', () => {
        const message = 'Failed to load wallet';
        const error = new WalletWalletLoadError(message);

        expect(error).toBeInstanceOf(WalletWalletLoadError);
        expect(error.message).toBe(message);
    });

    it('should create WalletWalletLoadError with message and error object', () => {
        const message = 'Wallet load error';
        const originalError = new Error('Module not found');
        const error = new WalletWalletLoadError(message, originalError);

        expect(error.message).toBe(message);
        expect(error.error).toBe(originalError);
    });
});

describe('WalletWindowClosedError', () => {
    it('should create WalletWindowClosedError with default message', () => {
        const error = new WalletWindowClosedError();

        expect(error).toBeInstanceOf(WalletError);
        expect(error).toBeInstanceOf(WalletWindowClosedError);
        expect(error.name).toBe('WalletWindowClosedError');
        expect(error.message).toBe('The QR window is closed.');
    });

    it('should create WalletWindowClosedError with custom message', () => {
        const message = 'Custom window closed message';
        const error = new WalletWindowClosedError(message);

        expect(error).toBeInstanceOf(WalletWindowClosedError);
        expect(error.message).toBe(message);
    });

    it('should create WalletWindowClosedError with message and error object', () => {
        const message = 'QR window closed by user';
        const originalError = new Error('User action');
        const error = new WalletWindowClosedError(message, originalError);

        expect(error.message).toBe(message);
        expect(error.error).toBe(originalError);
    });
});

describe('WalletSwitchChainError', () => {
    it('should create WalletSwitchChainError', () => {
        const error = new WalletSwitchChainError();

        expect(error).toBeInstanceOf(WalletError);
        expect(error).toBeInstanceOf(WalletSwitchChainError);
        expect(error.name).toBe('WalletSwitchChainError');
    });

    it('should create WalletSwitchChainError with message', () => {
        const message = 'Failed to switch chain';
        const error = new WalletSwitchChainError(message);

        expect(error).toBeInstanceOf(WalletSwitchChainError);
        expect(error.message).toBe(message);
    });

    it('should create WalletSwitchChainError with message and error object', () => {
        const message = 'Switch chain failed';
        const originalError = new Error('Chain not supported');
        const error = new WalletSwitchChainError(message, originalError);

        expect(error.message).toBe(message);
        expect(error.error).toBe(originalError);
    });
});

describe('WalletGetNetworkError', () => {
    it('should create WalletGetNetworkError', () => {
        const error = new WalletGetNetworkError();

        expect(error).toBeInstanceOf(WalletError);
        expect(error).toBeInstanceOf(WalletGetNetworkError);
        expect(error.name).toBe('WalletGetNetworkError');
    });

    it('should create WalletGetNetworkError with message', () => {
        const message = 'Failed to get network information';
        const error = new WalletGetNetworkError(message);

        expect(error).toBeInstanceOf(WalletGetNetworkError);
        expect(error.message).toBe(message);
    });

    it('should create WalletGetNetworkError with message and error object', () => {
        const message = 'Get network info failed';
        const originalError = new Error('Network unreachable');
        const error = new WalletGetNetworkError(message, originalError);

        expect(error.message).toBe(message);
        expect(error.error).toBe(originalError);
    });
});

describe('Error inheritance and instanceof checks', () => {
    it('should verify error instanceof chain for all error types', () => {
        const errors = [
            new WalletNotFoundError(),
            new WalletNotSelectedError(),
            new WalletDisconnectedError(),
            new WalletConnectionError(),
            new WalletDisconnectionError(),
            new WalletSignMessageError(),
            new WalletSignTransactionError(),
            new WalletWalletLoadError(),
            new WalletWindowClosedError(),
            new WalletSwitchChainError(),
            new WalletGetNetworkError(),
        ];

        errors.forEach((error) => {
            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(WalletError);
        });
    });

    it('should have correct name property for all error types', () => {
        const errorMap = {
            WalletNotFoundError: new WalletNotFoundError(),
            WalletNotSelectedError: new WalletNotSelectedError(),
            WalletDisconnectedError: new WalletDisconnectedError(),
            WalletConnectionError: new WalletConnectionError(),
            WalletDisconnectionError: new WalletDisconnectionError(),
            WalletSignMessageError: new WalletSignMessageError(),
            WalletSignTransactionError: new WalletSignTransactionError(),
            WalletWalletLoadError: new WalletWalletLoadError(),
            WalletWindowClosedError: new WalletWindowClosedError(),
            WalletSwitchChainError: new WalletSwitchChainError(),
            WalletGetNetworkError: new WalletGetNetworkError(),
        };

        Object.entries(errorMap).forEach(([expectedName, error]) => {
            expect(error.name).toBe(expectedName);
        });
    });
});

describe('Error serialization and toString', () => {
    it('should properly convert error to string', () => {
        const error = new WalletConnectionError('Connection failed');

        expect(error.toString()).toContain('WalletConnectionError');
        expect(error.toString()).toContain('Connection failed');
    });

    it('should have stack trace', () => {
        const error = new WalletError('Test error');

        expect(error.stack).toBeDefined();
        expect(error.stack).toContain('errors.test.ts');
    });
});
