/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
    transform: {
        '\\.tsx?$': [
            'ts-jest',
            {
                useESM: true,
                tsconfig: {
                    baseUrl: '.',
                    paths: {
                        '@tronweb3/abstract-adapter-evm': ['../abstract-adapter/src/index.ts'],
                    },
                },
            },
        ],
    },
    moduleNameMapper: {
        '^@tronweb3/abstract-adapter-evm$': '<rootDir>/../abstract-adapter/src/index.ts',
        '(.+)\\.js': '$1',
    },
    extensionsToTreatAsEsm: ['.ts'],
};
