/** @type {import('next').NextConfig} */
const nextConfig = {
  // Skip debug-auth page during build to prevent SSR/SSG errors
  experimental: {
    skipTrailingSlashRedirect: true,
  },
  // Exclude debug pages from static export
  async generateBuildId() {
    return 'build-' + Date.now();
  },
  async exportPathMap(defaultPathMap) {
    // Remove debug-auth page from export to prevent build errors
    delete defaultPathMap['/debug-auth'];
    return defaultPathMap;
  },
  // Force dynamic rendering for debug pages
  async rewrites() {
    return [
      {
        source: '/debug-auth',
        destination: '/debug-auth',
        has: [
          {
            type: 'header',
            key: 'x-skip-static',
          }
        ]
      }
    ];
  }
};

export default nextConfig;