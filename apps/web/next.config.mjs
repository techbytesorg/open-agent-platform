/** @type {import('next').NextConfig} */
const nextConfig = {
  // Export as static site (no server needed)
  output: "export",

  // Use trailing slashes for better static hosting
  trailingSlash: true,

  // Optimize images for static export
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
