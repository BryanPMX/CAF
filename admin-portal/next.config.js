/** @type {import('next').NextConfig} */
const nextConfig = {
  // Expose VITE_GOOGLE_MAPS_API_KEY to client as NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (same name on Vercel as marketing site)
  env: {
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.VITE_GOOGLE_MAPS_API_KEY,
  },

  // Temporarily disable React Strict Mode to prevent double renders
  reactStrictMode: false,
  
  
  
  // Minimal experimental features to avoid build issues
  experimental: {
    optimizeCss: false,
  },
  
  // Enable SWC minification at root level (not experimental)
  swcMinify: true,

  // Enable compression
  compress: true,

  // Optimize images
  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // Disable image optimization in development for faster builds
    unoptimized: process.env.NODE_ENV === 'development',
  },

  // Webpack optimizations
  webpack: (config, { dev, isServer }) => {
    // Ensure path aliases work in Vercel
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': require('path').resolve(__dirname, 'src'),
    };
    // Development optimizations
    if (dev) {
      // Faster source maps in development
      config.devtool = 'eval-cheap-module-source-map';
      
      // Disable some optimizations in development for faster builds
      config.optimization.minimize = false;
      config.optimization.splitChunks = false;
    }

    // Production optimizations
    if (!dev && !isServer) {
      // Enable tree shaking
      config.optimization.usedExports = true;
      config.optimization.sideEffects = false;

      // Split chunks for better caching
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 10,
            reuseExistingChunk: true,
          },
          antd: {
            test: /[\\/]node_modules[\\/]antd[\\/]/,
            name: 'antd',
            chunks: 'all',
            priority: 20,
            reuseExistingChunk: true,
          },
          icons: {
            test: /[\\/]node_modules[\\/]@ant-design[\\/]icons[\\/]/,
            name: 'antd-icons',
            chunks: 'all',
            priority: 15,
            reuseExistingChunk: true,
          },
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            priority: 5,
            reuseExistingChunk: true,
          },
        },
      };

      // Enable minification
      config.optimization.minimize = true;
      
      // Remove console logs in production (using built-in SWC minifier)
      // SWC handles console removal automatically in production builds
    }

    // SVG optimization
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });

    // Faster module resolution
    config.resolve.modules = ['node_modules'];
    config.resolve.extensions = ['.js', '.jsx', '.ts', '.tsx'];

    return config;
  },

  // Bundle analyzer (only in development)
  ...(process.env.ANALYZE === 'true' && {
    webpack: (config) => {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          openAnalyzer: false,
        })
      );
      return config;
    },
  }),

  // Performance optimizations
  poweredByHeader: false,
  generateEtags: false,

  // Headers for performance and security
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, stale-while-revalidate=600',
          },
        ],
      },
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;