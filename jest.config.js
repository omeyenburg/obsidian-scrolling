module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
    roots: ['<rootDir>/src', '<rootDir>/tests'],
    testMatch: ['**/tests/**/*.test.ts'],
    moduleNameMapper: { '^obsidian$': '<rootDir>/mocks/obsidian.ts' },
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
        '!src/main.ts',
        '!src/events.ts',
        '!src/settings.ts'
    ]
};
