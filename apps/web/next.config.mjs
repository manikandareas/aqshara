/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@aqshara/api"],
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        hostname: "pub-0e3c31890e074e21be51602d9fbffdd0.r2.dev",
        protocol: "https",
      },
    ],
  },
};

export default nextConfig;
