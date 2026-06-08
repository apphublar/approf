import type { NextConfig } from 'next'
import path from 'node:path'

const config: NextConfig = {
  outputFileTracingRoot: path.join(process.cwd(), '../..'),
  async rewrites() {
    const reviewAppUrl = (
      process.env.COORDINATOR_REVIEW_APP_URL
      || process.env.NEXT_PUBLIC_COORDINATOR_REVIEW_APP_URL
      || 'https://approf-admin.vercel.app'
    ).replace(/\/$/, '')

    return [
      {
        source: '/api/coordinator/public/:path*',
        destination: `${reviewAppUrl}/api/coordinator/public/:path*`,
      },
    ]
  },
}

export default config
