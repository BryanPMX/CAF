# admin-portal/dev.config.js
// Development configuration for faster builds

module.exports = {
  // Development optimizations
  development: {
    // Disable telemetry for faster startup
    NEXT_TELEMETRY_DISABLED: '1',
    
    // Enable webpack worker threads
    NEXT_WEBPACK_USE_WORKER_THREADS: '1',
    
    // Increase memory limit for faster builds
    NODE_OPTIONS: '--max-old-space-size=4096',
    
    // Disable source maps in development for faster builds
    GENERATE_SOURCEMAP: 'false',
    
    // Enable fast refresh
    FAST_REFRESH: 'true',
    
    // Disable ESLint during development for faster builds
    DISABLE_ESLINT_PLUGIN: 'true',
    
    // Disable TypeScript checking during development
    SKIP_TYPE_CHECK: 'true',
    
    // API URL
    NEXT_PUBLIC_API_URL: 'http://localhost:8080/api/v1',
    
    // Development optimizations
    NEXT_PUBLIC_DEV_MODE: 'true',
    NEXT_PUBLIC_ENABLE_PERFORMANCE_MONITORING: 'true',
  },
  
  // Performance monitoring
  performance: {
    // Enable bundle analyzer
    ANALYZE: 'false',
    
    // Enable performance monitoring
    NEXT_PUBLIC_PERFORMANCE_MONITORING: 'true',
    
    // Cache settings
    CACHE_TTL: '300000', // 5 minutes
    CACHE_MAX_SIZE: '100',
  },
  
  // Build optimizations
  build: {
    // Enable SWC minification
    SWC_MINIFY: 'true',
    
    // Enable experimental features
    EXPERIMENTAL_OPTIMIZE_CSS: 'true',
    EXPERIMENTAL_OPTIMIZE_PACKAGE_IMPORTS: 'true',
    
    // Disable image optimization in development
    NEXT_IMAGE_UNOPTIMIZED: 'true',
  }
};
