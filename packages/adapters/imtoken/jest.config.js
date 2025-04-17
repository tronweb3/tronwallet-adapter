/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
    transform: {
        '\\.tsx?$': [
            'ts-jest',
            {
                useESM: true,
            },
        ],
    },
    moduleNameMapper: {
        'bignumber\\.js': '$0',
        '(.+)\\.js': '$1',
    },
    extensionsToTreatAsEsm: ['.ts'],
    resolver: './resolver.cjs',
};
