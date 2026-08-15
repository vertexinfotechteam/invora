import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { appUrl } from '@/lib/app-url';

/**
 * These cover the regression that took sign-up down in production: `originUrl()`
 * used to throw when `NEXT_PUBLIC_APP_URL` was unset, which aborted the server
 * action before Supabase was ever called. The contract now is that a public
 * origin is *always* resolvable and this never throws.
 */
const VARS = ['NEXT_PUBLIC_APP_URL', 'VERCEL_PROJECT_PRODUCTION_URL', 'VERCEL_URL'] as const;

const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of VARS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of VARS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe('appUrl', () => {
  it('prefers the explicitly configured URL over everything else', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://invora.app';
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'invorateam12.vercel.app';
    process.env.VERCEL_URL = 'deployment-xyz.vercel.app';

    expect(appUrl()).toBe('https://invora.app');
  });

  it('strips trailing slashes so callers can concatenate a path directly', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://invora.app///';
    expect(appUrl()).toBe('https://invora.app');
  });

  it('falls back to the stable production domain before the per-deploy URL', () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'invorateam12.vercel.app';
    process.env.VERCEL_URL = 'deployment-xyz.vercel.app';

    expect(appUrl()).toBe('https://invorateam12.vercel.app');
  });

  it('uses the per-deploy URL when that is all there is (preview deploys)', () => {
    process.env.VERCEL_URL = 'deployment-xyz.vercel.app';
    expect(appUrl()).toBe('https://deployment-xyz.vercel.app');
  });

  it('adds https:// to the Vercel domains, which arrive without a scheme', () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'invorateam12.vercel.app';
    expect(appUrl()).toMatch(/^https:\/\//);
  });

  it('treats an empty or whitespace-only value as unset rather than as ""', () => {
    process.env.NEXT_PUBLIC_APP_URL = '   ';
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'invorateam12.vercel.app';

    expect(appUrl()).toBe('https://invorateam12.vercel.app');
  });

  it('never throws when nothing at all is configured', () => {
    expect(() => appUrl()).not.toThrow();
    expect(appUrl()).toBe('http://localhost:3000');
  });
});
