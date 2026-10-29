/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow local hostname access in development
  ...(process.env.NODE_ENV === 'development' && {
    experimental: {
      allowedDevOrigins: ['fedora:3000', 'fedora:8081'],
    },
  }),
};

export default nextConfig;
