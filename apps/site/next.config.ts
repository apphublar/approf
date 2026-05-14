import type { NextConfig } from 'next'
import path from 'node:path'

const config: NextConfig = {
  outputFileTracingRoot: path.join(process.cwd(), '../..'),
}

export default config
