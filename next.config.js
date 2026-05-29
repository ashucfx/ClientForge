/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
    webpackBuildWorker: false,
    workerThreads: true,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    domains: [],
  },

  // ── Security headers ──────────────────────────────────────────────────────
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Prevent embedding in iframes (clickjacking)
          { key: 'X-Frame-Options',        value: 'DENY' },
          // Prevent MIME-type sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Content Security Policy — prevent XSS and data exfiltration
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://res.cloudinary.com",
              "connect-src 'self' https://api.razorpay.com https://lumberjack-cx.razorpay.com https://api-m.paypal.com https://api-m.sandbox.paypal.com",
              "frame-src https://api.razorpay.com https://checkout.razorpay.com",
              "object-src 'none'",
              "base-uri 'self'",
            ].join('; '),
          },
          // Control referrer information leakage
          { key: 'Referrer-Policy',        value: 'strict-origin-when-cross-origin' },
          // Disable browser features not used by this app
          { key: 'Permissions-Policy',     value: 'camera=(), microphone=(), geolocation=()' },
          // Force HTTPS for 1 year, include subdomains
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          // Basic XSS protection for older browsers
          { key: 'X-XSS-Protection',       value: '1; mode=block' },
        ],
      },
      // Cache API responses appropriately
      {
        source: '/api/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
