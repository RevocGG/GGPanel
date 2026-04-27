import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname),
  serverExternalPackages: ['@prisma/client', 'prisma', '@prisma/adapter-libsql', '@libsql/client'],
}

export default nextConfig
