/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Card photos go up with the edit form; allow up to the 2 MB photo limit
  // plus the rest of the form.
  experimental: {
    serverActions: { bodySizeLimit: '3mb' },
    // src/proxy.ts sees every request; let it pass the import page's uploads
    // (up to 100 MB) through whole.
    proxyClientMaxBodySize: '110mb',
  },
};
export default nextConfig;
