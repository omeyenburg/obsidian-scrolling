module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
    roots: ['<rootDir>/src', '<rootDir>/test'],
    testMatch: ['**/test/**/*.test.ts'],
    moduleNameMapper: { 
        '^obsidian$': '<rootDir>/mocks/obsidian.ts',
        '^@core/(.*)$': '<rootDir>/src/core/$1',
        '^@components/(.*)$': '<rootDir>/src/components/$1'
    },
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
        '!src/main.ts',
        '!src/events.ts',
        '!src/settings.ts'
    ]
};
