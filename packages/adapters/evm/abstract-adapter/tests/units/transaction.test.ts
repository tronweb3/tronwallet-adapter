import { describe, test, expectTypeOf } from 'vitest';
import type {
    AccessList,
    EIP1559Transaction,
    EIP2930Transaction,
    LegacyTransaction,
    Transaction,
} from '../../src/adapter.js';

describe('Transaction type — valid shapes', () => {
    test('LegacyTransaction accepts gasPrice and explicit type 0x0', () => {
        const tx: LegacyTransaction = {
            type: '0x0',
            from: '0xabc',
            to: '0xdef',
            gasPrice: '0x1',
            gas: '0x5208',
            value: '0x0',
        };
        expectTypeOf(tx).toMatchTypeOf<Transaction>();
    });

    test('LegacyTransaction allows omitting the type field', () => {
        const tx: LegacyTransaction = {
            from: '0xabc',
            to: '0xdef',
            gasPrice: '0x1',
        };
        expectTypeOf(tx).toMatchTypeOf<Transaction>();
    });

    test('EIP2930Transaction requires type 0x1 and accepts accessList + gasPrice', () => {
        const tx: EIP2930Transaction = {
            type: '0x1',
            from: '0xabc',
            to: '0xdef',
            gasPrice: '0x1',
            accessList: [
                {
                    address: '0xabc',
                    storageKeys: ['0x0', '0x1'],
                },
            ],
        };
        expectTypeOf(tx).toMatchTypeOf<Transaction>();
    });

    test('EIP1559Transaction accepts dynamic-fee fields and accessList', () => {
        const tx: EIP1559Transaction = {
            type: '0x2',
            from: '0xabc',
            to: '0xdef',
            maxFeePerGas: '0x1',
            maxPriorityFeePerGas: '0x1',
            accessList: [{ address: '0xabc', storageKeys: ['0x0'] }],
        };
        expectTypeOf(tx).toMatchTypeOf<Transaction>();
    });

    test('EIP1559Transaction allows omitting the type field (default modern tx)', () => {
        const tx: EIP1559Transaction = {
            from: '0xabc',
            maxFeePerGas: '0x1',
            maxPriorityFeePerGas: '0x1',
        };
        expectTypeOf(tx).toMatchTypeOf<Transaction>();
    });
});

describe('Transaction type — required fields', () => {
    test('from is required on every variant', () => {
        expectTypeOf<LegacyTransaction>().toHaveProperty('from').toEqualTypeOf<`0x${string}`>();
        expectTypeOf<EIP2930Transaction>().toHaveProperty('from').toEqualTypeOf<`0x${string}`>();
        expectTypeOf<EIP1559Transaction>().toHaveProperty('from').toEqualTypeOf<`0x${string}`>();
    });

    test('to is optional (contract deployment)', () => {
        const tx: EIP1559Transaction = {
            from: '0xabc',
            data: '0x6080',
            maxFeePerGas: '0x1',
        };
        expectTypeOf(tx).toMatchTypeOf<Transaction>();
    });
});

describe('Transaction type — exclusion via never', () => {
    test('LegacyTransaction rejects EIP-1559 fee fields', () => {
        const tx: LegacyTransaction = {
            from: '0xabc',
            // @ts-expect-error — maxFeePerGas is `never` on LegacyTransaction
            maxFeePerGas: '0x1',
        };
        void tx;
    });

    test('LegacyTransaction rejects accessList', () => {
        const tx: LegacyTransaction = {
            from: '0xabc',
            // @ts-expect-error — accessList is `never` on LegacyTransaction
            accessList: [],
        };
        void tx;
    });

    test('EIP2930Transaction rejects EIP-1559 fee fields', () => {
        const tx: EIP2930Transaction = {
            type: '0x1',
            from: '0xabc',
            // @ts-expect-error — maxPriorityFeePerGas is `never` on EIP2930Transaction
            maxPriorityFeePerGas: '0x1',
        };
        void tx;
    });

    test('EIP1559Transaction rejects gasPrice', () => {
        const tx: EIP1559Transaction = {
            from: '0xabc',
            maxFeePerGas: '0x1',
            // @ts-expect-error — gasPrice is `never` on EIP1559Transaction
            gasPrice: '0x1',
        };
        void tx;
    });
});

describe('Transaction type — type-field literals', () => {
    test('rejects an unknown transaction type', () => {
        const tx: Transaction = {
            from: '0xabc',
            // @ts-expect-error — '0x9' is not a valid transaction type
            type: '0x9',
        };
        void tx;
    });

    test('EIP2930Transaction requires type 0x1 explicitly', () => {
        // @ts-expect-error — type is required on EIP2930Transaction
        const tx: EIP2930Transaction = {
            from: '0xabc',
            gasPrice: '0x1',
        };
        void tx;
    });
});

describe('Transaction type — discriminated union narrowing', () => {
    test('narrowing by type literal isolates each variant', () => {
        const narrow = (tx: Transaction) => {
            if (tx.type === '0x1') {
                expectTypeOf(tx).toMatchTypeOf<EIP2930Transaction>();
            } else if (tx.type === '0x2') {
                expectTypeOf(tx).toMatchTypeOf<EIP1559Transaction>();
            } else {
                expectTypeOf(tx).toMatchTypeOf<LegacyTransaction | EIP1559Transaction>();
            }
        };
        void narrow;
    });
});

describe('AccessList type', () => {
    test('AccessList entries require address and storageKeys hex strings', () => {
        const list: AccessList = [
            { address: '0xabc', storageKeys: ['0x0'] },
            { address: '0xdef', storageKeys: [] },
        ];
        expectTypeOf(list).toEqualTypeOf<AccessList>();
    });

    test('AccessList entry rejects non-hex address', () => {
        const list: AccessList = [
            // @ts-expect-error — address must be `0x${string}`
            { address: 'plain-string', storageKeys: [] },
        ];
        void list;
    });
});
