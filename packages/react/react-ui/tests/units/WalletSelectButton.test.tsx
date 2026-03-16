import React, { act } from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { vi, describe, beforeEach, test, expect } from 'vitest';

import type { ButtonProps } from '../../src/Button.js';
import { WalletSelectButton } from '../../src/WalletSelectButton.js';
import { Providers } from './TestProviders.js';
import { MockTronLink } from './MockTronLink.js';

const makeSut = (props: ButtonProps = {}) => render(<WalletSelectButton {...props} />, { wrapper: Providers });

(window as any).open = vi.fn();
beforeEach(() => {
    localStorage.clear();
    (window as any).tronLink = new MockTronLink();
    (window as any).tronWeb = (window as any).tronLink.tronWeb;
    vi.clearAllMocks();
});
describe('WalletSelectButton', () => {
    test('should work fine with basic usage', () => {
        const { container } = makeSut({});
        const button = container.querySelector('button');
        expect(button).toBeInTheDocument();
        expect(button?.disabled).toBe(false);
        expect(button?.textContent).toEqual('Select Wallet');
    });

    test('should work fine when select', async () => {
        const { getByTestId, getByText, queryByTestId } = makeSut({});
        await act(async () => {
            fireEvent.click(getByTestId('wallet-select-button'));
        });

        expect(getByTestId('wallet-select-modal')).toBeInTheDocument();
        await act(async () => {
            fireEvent.click(getByText('TronLink'));
        });
        await waitFor(() => {
            expect(queryByTestId('wallet-select-modal')).toBeNull();
        });
        expect(localStorage.getItem('tronAdapterName')).toEqual(`"TronLink"`);
    });
});
