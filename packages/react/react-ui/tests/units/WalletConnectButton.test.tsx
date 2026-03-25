import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { vi, describe, beforeEach, test, expect } from 'vitest';

import type { ButtonProps } from '../../src/Button.js';
import { WalletConnectButton } from '../../src/WalletConnectButton.js';
import { Providers, NoAutoConnectProviders } from './TestProviders.js';
import { MockTronLink } from './MockTronLink.js';

const makeSut = (props: ButtonProps = {}) => render(<WalletConnectButton {...props} />, { wrapper: Providers });
const makeSutNoAutoConnect = (props: ButtonProps = {}) =>
    render(<WalletConnectButton {...props} />, { wrapper: NoAutoConnectProviders });

beforeEach(() => {
    localStorage.clear();
    (window as any).tronLink = new MockTronLink();
    (window as any).tronWeb = (window as any).tronLink.tronWeb;
    vi.clearAllMocks();
});

describe('basic usage', () => {
    test('should work fine with basic usage', () => {
        const { container } = makeSut({
            className: 'test-class-name',
            tabIndex: 20,
            style: { borderColor: 'red' },
        });
        const button = container.querySelector('button');
        expect(button).toBeInTheDocument();
        // class change will influence style
        expect(button?.classList.contains('adapter-react-button')).toBe(true);
        expect(button?.classList.contains('test-class-name')).toBe(true);
        expect(button?.tabIndex).toBe(20);
        expect(button?.style.borderColor).toBe('red');
        expect(button?.disabled).toBe(true);
        expect(button?.textContent).toEqual('Connect Wallet');
    });
});

describe('when no wallet is selected', () => {
    test('should be disabled', async () => {
        const { getByTestId } = makeSut();
        expect(getByTestId('wallet-connect-button')).toBeDisabled();
        expect(getByTestId('wallet-connect-button')).toHaveTextContent('Connect Wallet');
    });
});

describe('when a wallet is seleted', () => {
    beforeEach(() => {
        localStorage.setItem('tronAdapterName', '"TronLink"');
    });
    describe('when tronlink is avaliable', () => {
        test('should auto connect and be disabled when antoConnect enabled', async () => {
            const { getByTestId } = makeSut({});
            await waitFor(
                () => {
                    const el = getByTestId('wallet-connect-button');
                    expect(el).toBeInTheDocument();
                    expect(el).toBeDisabled();
                    expect(el).toHaveTextContent('Connected');
                },
                { timeout: 1000 }
            );
        });
        test('tronlink is connected when antoConnect disabled', async () => {
            const { getByTestId } = makeSutNoAutoConnect({});
            await waitFor(
                () => {
                    const el = getByTestId('wallet-connect-button');
                    expect(el).toBeInTheDocument();
                    expect(el).toBeDisabled();
                    expect(el).toHaveTextContent('Connected');
                },
                { timeout: 1000 }
            );
        });
    });

    describe('when tronlink is not avaliable', () => {
        beforeEach(() => {
            (window as any).tronLink = undefined;
            (window as any).tronWeb = undefined;
        });
        test('should not be disabled with autoConnect disabled', async () => {
            const { getByTestId } = makeSutNoAutoConnect();
            expect(getByTestId('wallet-connect-button')).not.toBeDisabled();
            expect(getByTestId('wallet-connect-button')).toHaveTextContent('Connect');
        });
    });
});
