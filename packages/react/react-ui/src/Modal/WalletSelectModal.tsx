import { useWallet } from '@tronweb3/tronwallet-adapter-react-hooks';
import type { Wallet } from '@tronweb3/tronwallet-adapter-react-hooks';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FC, PropsWithChildren } from 'react';
import { AdapterState } from '@tronweb3/tronwallet-abstract-adapter';
import { ReactPortal } from './ReactPortal.js';
import { WalletItem } from '../WalletItem.js';

type ModalProps = PropsWithChildren<{
    visible: boolean;
    onClose: () => void;
    openUrlWhenWalletNotFoundSync?: boolean;
}>;
export const WalletSelectModal: FC<ModalProps> = function ({
    visible,
    onClose,
    openUrlWhenWalletNotFoundSync = false,
}) {
    const nodeRef = useRef(null);
    const { wallets, select } = useWallet();
    const [fadeIn, setFadeIn] = useState(false);
    const [render, setRender] = useState(false);

    const walletsList = useMemo(
        () => [
            ...wallets.filter((a: any) => a.state !== AdapterState.NotFound),
            ...wallets.filter((a: any) => a.state === AdapterState.NotFound),
        ],
        [wallets]
    );

    const onWalletClick = useCallback(
        (wallet: Wallet) => {
            if (openUrlWhenWalletNotFoundSync && wallet.state === AdapterState.NotFound) {
                if (wallet.adapter.url) {
                    window.open(wallet.adapter.url, '_blank');
                }
                return;
            }
            select(wallet.adapter.name);
            onClose();
        },
        [select, onClose, openUrlWhenWalletNotFoundSync]
    );
    function show() {
        setRender(true);
        setFadeIn(true);
    }
    function close() {
        setFadeIn(false);
        // setRender(false)
        setTimeout(() => setRender(false), 200);
    }

    useEffect(
        function () {
            if (visible) {
                show();
            } else {
                close();
            }
        },
        [visible]
    );
    useEffect(() => {
        const closeOnEscapeKey = (e: any) => (e.key === 'Escape' ? onClose() : null);
        document.body.addEventListener('keydown', closeOnEscapeKey);
        return () => {
            document.body.removeEventListener('keydown', closeOnEscapeKey);
        };
    }, [onClose]);

    return render ? (
        <ReactPortal wrapperId="react-portal-modal-container">
            <div
                data-testid="wallet-select-modal"
                ref={nodeRef}
                className={`adapter-modal ${fadeIn && 'adapter-modal-fade-in'}`}
            >
                <div className="adapter-modal-wrapper">
                    <div className="adapter-modal-header">
                        <button onClick={onClose} className="close-button" tabIndex={0}></button>
                        <div className="adapter-modal-title">
                            Connect a wallet on
                            <br />
                            Tron to continue
                        </div>
                    </div>

                    <div className="adapter-list">
                        {walletsList.map((wallet) => (
                            <WalletItem
                                key={wallet.adapter.name}
                                wallet={wallet}
                                onClick={() => onWalletClick(wallet)}
                            ></WalletItem>
                        ))}
                    </div>
                </div>
            </div>
        </ReactPortal>
    ) : null;
};
