// eslint-disable-next-line @typescript-eslint/no-var-requires

// next.config.js
const isBuilding = process.env.NEXT_PHASE === 'phase-production-build';
const CopyWebpackPlugin = require('copy-webpack-plugin');
const path = require('path');

const ContentSecurityPolicy = `
  default-src 'self' https: http:;
  script-src 'self' 'unsafe-eval' 'unsafe-inline' https: http:;
  style-src 'self' 'unsafe-inline' https: http:;
  img-src 'self' data: blob: https: http:;
  font-src 'self' data: https: http:;
  connect-src 'self' https: http: ws: wss:;
  frame-src 'self' https: http:;
`;

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['medemap-demo.cmclab.science'],
  reactStrictMode: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  // Turbopack configuration for Next.js 16
  turbopack: {},
  // Reduce logging in development for better performance
  logging: {
    fetches: {
      fullUrl: false,
    },
    level: 'error',
  },
experimental: {
    optimizeCss: false,
    // turbotrace: {
    //   logLevel: 'error'
    // }
  },
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Performance: Only copy Cesium files in production builds
    if (!dev) {
      // Tell webpack to include the cesium static files in the build
      config.plugins.push(
        new CopyWebpackPlugin({
          patterns: [
            {
              from: path.join(__dirname, 'node_modules/cesium/Build/Cesium/Workers'),
              to: 'public/Workers',
              info: { minimized: true }
            },
            {
              from: path.join(__dirname, 'node_modules/cesium/Build/Cesium/ThirdParty'),
              to: 'public/ThirdParty',
              info: { minimized: true }
            },
            {
              from: path.join(__dirname, 'node_modules/cesium/Build/Cesium/Assets'),
              to: 'public/Assets',
              info: { minimized: true }
            },
            {
              from: path.join(__dirname, 'node_modules/cesium/Build/Cesium/Widgets'),
              to: 'public/Widgets',
              info: { minimized: true }
            },
            {
              from: path.join(__dirname, 'node_modules/cesium/Build/Cesium'),
              to: 'public/Cesium',
              info: { minimized: true }
            },
          ],
        })
      );
    }

    // Tell webpack where to look for the cesium static files in the code
    config.resolve.alias['cesium$'] = 'cesium/Cesium';
    config.resolve.alias['cesium'] = 'cesium/Source';
    config.resolve.alias['@components'] = path.join(__dirname, 'components');
    config.resolve.alias['@emotion/react'] = path.resolve(__dirname, 'node_modules/@emotion/react');

    config.module.rules.push({
      test: /\.worker\.js$/,
      use: { loader: 'worker-loader' },
    });

    // Exclude Cesium's worker files from processing
    config.module.rules.push({
      test: /\.js$/,
      include: /public\/Cesium\/Workers/,
      use: { loader: 'file-loader' }
    });

    // Add transpilation for Cesium module - commented out to avoid babel-loader issues
    // config.module.rules.push({
    //   test: /node_modules\/cesium/,
    //   use: {
    //     loader: 'babel-loader',
    //     options: {
    //       presets: ['@babel/preset-env', '@babel/preset-typescript'],
    //     },
    //   },
    // });

    // Development performance optimizations (only for non-Turbo builds)
    if (dev && !process.env.TURBO) {
      // Faster builds in development
      config.optimization = {
        ...config.optimization,
        removeAvailableModules: false,
        removeEmptyChunks: false,
        splitChunks: false,
      };

      // Reduce bundle analysis overhead
      config.resolve.symlinks = false;
      config.resolve.cacheWithContext = false;
    }

    // Ensure modules are not available on the server
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        module: false,
      };
    }

    return config;
  },
  async rewrites() {
    return [
      // {
      //   source: '/api/serversidelogging',
      //   destination: 'http://localhost:4000/api/serversidelogging',
      // },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: ContentSecurityPolicy.replace(/\s{2,}/g, ' ').trim()
          }
        ]
      }
    ];
  },
}

if (process.env.DISABLE_BUILD_OPT === 'true') {
    nextConfig.swcMinify = false;
    nextConfig.experimental = {
      ...nextConfig.experimental,
      outputFileTracingExcludes: {
        '*': ['./node_modules/**/*']
      }
    };
  }

module.exports = nextConfig;
