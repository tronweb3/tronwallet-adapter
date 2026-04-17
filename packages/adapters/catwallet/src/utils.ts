import { isInBrowser } from '@tronweb3/tronwallet-abstract-adapter';
import type { CatWalletTron } from './types.js';

declare global {
    interface Window {
        catwallet?: { tron?: CatWalletTron };
    }
}

export function getCatWalletTronProvider(): CatWalletTron | null {
    if (!isInBrowser()) return null;
    const tron = window.catwallet?.tron;
    return tron?.isCatWallet ? tron : null;
}

export function supportCatWallet() {
    return !!getCatWalletTronProvider();
}

export async function waitTronwebReady(tronObj: CatWalletTron) {
    return new Promise<void>((resolve, reject) => {
        const interval = setInterval(() => {
            if (tronObj.tronWeb) {
                clearInterval(interval);
                clearTimeout(timeout);
                resolve();
            }
        }, 50);
        const timeout = setTimeout(() => {
            clearInterval(interval);
            reject('`window.tron.tronWeb` is not ready.');
        }, 2000);
    });
}
