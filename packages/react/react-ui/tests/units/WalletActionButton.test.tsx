import React, { act } from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';

import type { ButtonProps } from '../../src/Button.js';
import { WalletActionButton } from '../../src/WalletActionButton.js';
import { Providers, NoAutoConnectProviders } from './TestProviders.js';
import { MockTronLink } from './MockTronLink.js';

const makeSut = (props: ButtonProps = {}) => render(<WalletActionButton {...props} />, { wrapper: Providers });

(window as any).open = vi.fn();
const makeSutNoAutoConnect = (props: ButtonProps = {}) =>
    render(<WalletActionButton {...props} />, { wrapper: NoAutoConnectProviders });

beforeEach(() => {
    localStorage.clear();
    (window as any).tronLink = new MockTronLink();
    (window as any).tronWeb = (window as any).tronLink.tronWeb;
    vi.clearAllMocks();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('when tronlink is avaliable', () => {
    describe('when no wallet is selected', () => {
        test('selectButton should exist', async () => {
            const { getByTestId } = makeSut();
            expect(getByTestId('wallet-select-button')).toBeInTheDocument();
        });

        test('actionButton exist after select a wallet when autoConnect enabled', async () => {
            const { getByTestId, getByText } = makeSut();
            fireEvent.click(getByTestId('wallet-select-button'));
            expect(getByTestId('wallet-select-modal')).toBeInTheDocument();
            fireEvent.click(getByText('TronLink'));
            expect(getByTestId('wallet-action-button')).toBeInTheDocument();
        });
    });
    describe('when a wallet is seleted', () => {
        beforeEach(() => {
            localStorage.setItem('tronAdapterName', '"TronLink"');
        });

        test('actionButton should exist when autoConnect enabled', () => {
            const { getByTestId } = makeSut({});
            expect(getByTestId('wallet-action-button')).toBeInTheDocument();
        });
    });
});

describe('when tronlink is not avaliable', () => {
    beforeEach(() => {
        (window as any).tronLink = undefined;
        (window as any).tronWeb = undefined;
    });
    describe('when no wallet is selected', () => {
        test('selectButton should exist', async () => {
            const { getByTestId } = makeSut();
            expect(getByTestId('wallet-select-button')).toBeInTheDocument();
        });
    });
});

describe('when tronlink is avaliable but not ready', () => {
    beforeEach(() => {
        ((window as any).tronLink as MockTronLink).setReadyState(false);
        ((window as any).tronLink as MockTronLink).address = '';
    });
    describe('when no wallet is selected', () => {
        test('selectButton should exist', async () => {
            const { getByTestId } = makeSut();
            await waitFor(() => {
                expect(getByTestId('wallet-select-button')).toBeInTheDocument();
            });
        });

        test('should work fine when select a wallet', async () => {
            const { getByTestId, getByText, queryByTestId, findByTestId } = makeSutNoAutoConnect();
            await act(async () => {
                fireEvent.click(getByTestId('wallet-select-button'));
            });

            await waitFor(() => {
                expect(getByTestId('wallet-select-modal')).toBeInTheDocument();
            });
            const tronLinkBtn = getByText('TronLink');
            expect(tronLinkBtn).toBeInTheDocument();
            await act(async () => {
                fireEvent.click(tronLinkBtn);
            });
            await waitFor(async () => {
                expect(queryByTestId('wallet-select-modal')).toBeNull();
                expect(queryByTestId('wallet-connect-button')).toBeInTheDocument();
            });
            fireEvent.click(await findByTestId('wallet-connect-button'));
            await waitFor(() => {
                expect(queryByTestId('wallet-action-button')).toBeInTheDocument();
            });
        });
    });

    describe('when a wallet is selected', () => {
        beforeEach(() => {
            localStorage.setItem('tronAdapterName', '"TronLink"');
        });
        test('should work fine when autoConnect enabled', async () => {
            const { getByTestId, queryByTestId } = makeSut();
            // autoconnect
            expect(queryByTestId('wallet-connect-button')).toBeInTheDocument();
            await waitFor(
                () => {
                    expect(getByTestId('wallet-action-button')).toBeInTheDocument();
                },
                { timeout: 30 }
            );
        });
        test('should work fine when autoConnect disabled', async () => {
            const { getByTestId } = makeSutNoAutoConnect();
            // autoconnect
            await waitFor(() => {
                expect(getByTestId('wallet-connect-button')).toBeInTheDocument();
            });

            await act(async () => {
                fireEvent.click(getByTestId('wallet-connect-button'));
                await Promise.resolve();
            });
            await waitFor(() => {
                expect(getByTestId('wallet-connect-button')).toHaveTextContent('Connecting');
            });

            await waitFor(() => {
                expect(getByTestId('wallet-action-button')).toBeInTheDocument();
            });
        });
    });
});
