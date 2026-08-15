import type { MetadataRoute } from 'next';
import { appUrl as siteUrl } from '@/lib/app-url';

const appUrl = siteUrl();

/**
 * Everything that isn't a marketing page is disallowed here as a courtesy to
 * crawlers (saves crawl budget on pages they can't render anyway behind
 * auth), on top of — not instead of — the per-route `noindex` metadata that
 * is the actual signal search engines follow.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/dashboard',
        '/customers',
        '/products',
        '/quotations',
        '/invoices',
        '/payments',
        '/reports',
        '/assistant',
        '/search',
        '/settings',
        '/onboarding',
        '/admin',
        '/login',
        '/signup',
        '/forgot-password',
        '/reset-password',
        '/auth',
        '/api',
      ],
    },
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
