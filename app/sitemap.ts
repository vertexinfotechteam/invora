import type { MetadataRoute } from 'next';

const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');

/**
 * Only public marketing pages belong here. Everything behind auth is
 * per-tenant and has nothing for an anonymous crawler to index — listing it
 * would just be noise (or, for a page like /admin, actively unhelpful).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const pages: { path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }[] = [
    { path: '/', changeFrequency: 'weekly', priority: 1 },
    { path: '/pricing', changeFrequency: 'weekly', priority: 0.9 },
    { path: '/contact', changeFrequency: 'monthly', priority: 0.5 },
    { path: '/terms', changeFrequency: 'yearly', priority: 0.2 },
    { path: '/privacy', changeFrequency: 'yearly', priority: 0.2 },
    { path: '/refunds', changeFrequency: 'yearly', priority: 0.2 },
  ];

  return pages.map((page) => ({
    url: `${appUrl}${page.path}`,
    lastModified: now,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
