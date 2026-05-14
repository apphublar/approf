import type { NextConfig } from 'next'
import path from 'node:path'

const config: NextConfig = {
  outputFileTracingRoot: path.join(process.cwd(), '../..'),
  transpilePackages: ['@approf/auth', '@approf/types'],
}

export default config
