// next/jest wires up the same SWC transform, path aliases and CSS/asset stubs the
// Next build uses, so tests see modules exactly as the app does.
const nextJest = require('next/jest')

const createJestConfig = nextJest({ dir: './' })

/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // Keep Next's build output and deps out of test discovery.
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
}

module.exports = createJestConfig(config)
