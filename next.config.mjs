// @ts-check

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  productionBrowserSourceMaps: true,
  transpilePackages: ["next-mdx-remote"],
  output: "standalone",
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname:
          "pixelating.nyc3.digitaloceanspaces.com"
      },
    ],
  },
};

export default nextConfig;
