/** @type {import('next').NextConfig} */
const backendProxyTarget = (process.env.MANUAL_REQUEST_PROXY_TARGET || 'http://127.0.0.1:3000').replace(/\/$/, '')

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/backend-api/:path*',
        destination: `${backendProxyTarget}/:path*`,
      },
    ]
  },
}

module.exports = nextConfig
