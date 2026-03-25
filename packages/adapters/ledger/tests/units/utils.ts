import { TronWeb } from 'tronweb';

export const tronWeb = new TronWeb({
    fullHost: 'https://api.nileex.io',
});

export async function createTestTransaction() {
    const account1 = tronWeb.utils.accounts.generateAccount();
    const account2 = tronWeb.utils.accounts.generateAccount();
    return await tronWeb.transactionBuilder.sendTrx(account1.address.base58, 1000, account2.address.base58, {
        blockHeader: {
            ref_block_bytes: '0add',
            ref_block_hash: '6c2763abadf9ed29',
            expiration: 1581308685000,
            timestamp: 1581308626092,
        },
    });
}
