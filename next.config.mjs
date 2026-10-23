/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Card photos go up with the edit form; allow up to the 2 MB photo limit
  // plus the rest of the form.
  experimental: {
    serverActions: { bodySizeLimit: '3mb' },
  },
};
export default nextConfig;
