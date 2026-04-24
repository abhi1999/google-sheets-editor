/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['lh3.googleusercontent.com', 'googleusercontent.com'],
  },
  experimental: {
    serverComponentsExternalPackages: ['googleapis'],
  },
};

module.exports = nextConfig;
