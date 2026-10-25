/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Phosphor ships every icon (in six weights) behind one index file. Without this, each
    // page compiles all ~4,500 of those modules to use a handful; with it, Next rewrites
    // `import { X } from '@phosphor-icons/react'` to load only the icons a file names.
    optimizePackageImports: ['@phosphor-icons/react'],
  },
}

module.exports = nextConfig
