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
  // No other site may show the book in a frame: a hidden frame under a lure page
  // could turn the user's clicks into edits (clickjacking).
  // In a production build the pages may connect only to the app itself and to
  // GitHub, for the update check the About sheet makes when its button is
  // pressed: the browser refuses anything else. (Not while developing: live
  // reload needs its own connection.)
  // The photo route sends its own, stricter policy (which also forbids framing);
  // a header set here would replace it, so the CSP rule leaves that route out.
  async headers() {
    const policy = ["frame-ancestors 'none'"];
    if (process.env.NODE_ENV === 'production') policy.push("connect-src 'self' https://api.github.com");
    const csp = [{ key: 'Content-Security-Policy', value: policy.join('; ') }];
    return [
      { source: '/:path*', headers: [{ key: 'X-Frame-Options', value: 'DENY' }] },
      { source: '/', headers: csp },
      { source: '/:path((?!api/photo/).+)', headers: csp },
    ];
  },
};
export default nextConfig;
