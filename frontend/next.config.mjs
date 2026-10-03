/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow Next.js to import plotly correctly
  transpilePackages: ["react-plotly.js", "plotly.js"],
  webpack: (config) => {
    // plotly.js requires these fallbacks in Next.js webpack
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      os: false,
    };
    return config;
  },
};

export default nextConfig;
