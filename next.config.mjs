/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Lint runs explicitly via `npm run lint`; it should not fail production builds.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
