/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.ELECTRON_BUILD === 'true' ? 'export' : undefined,
  trailingSlash: true,
}

export default nextConfig
