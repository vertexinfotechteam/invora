/** @type {import('next').NextConfig} */

// Security headers. CSP is intentionally explicit about the third parties Invora
// talks to: Razorpay checkout, Supabase (REST + realtime + storage) and Sentry.
const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co').origin;
  } catch {
    return 'https://*.supabase.co';
  }
})();

const csp = [
  `default-src 'self'`,
  // Razorpay checkout injects its own script + inline bootstrap.
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: ${supabaseHost} https://*.supabase.co`,
  `font-src 'self' data:`,
  `connect-src 'self' ${supabaseHost} https://*.supabase.co wss://*.supabase.co https://api.razorpay.com https://lumberjack.razorpay.com https://*.ingest.sentry.io`,
  `frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
].join('; ');

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // @react-pdf/renderer must stay a real Node dependency inside route handlers.
  serverExternalPackages: ['@react-pdf/renderer', 'razorpay'],
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**.supabase.co' }],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
