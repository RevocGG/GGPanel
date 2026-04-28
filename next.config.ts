import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['@prisma/client', 'prisma', '@prisma/adapter-libsql', '@libsql/client'],
}

export default nextConfig
