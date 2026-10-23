import type { NextConfig } from 'next';

// Static export served from the site root ('/'). There is no server, API route,
// middleware or image optimisation: `next build` writes plain files to out/.
const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  poweredByHeader: false,
  // `npm run lint` is the lint gate (CI runs it separately); the in-build TypeScript check stays on.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
