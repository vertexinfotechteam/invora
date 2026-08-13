'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  FileText,
  LayoutDashboard,
  Package,
  Palette,
  Receipt,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { InvoraMark } from '@/components/marketing/nav';
import { UsageMeter, type UsageSnapshot } from '@/components/app/usage-meter';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/quotations', label: 'Quotations', icon: FileText },
  { href: '/invoices', label: 'Invoices', icon: Receipt },
  { href: '/payments', label: 'Payments', icon: Wallet },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/products', label: 'Catalog', icon: Package },
  { href: '/assistant', label: 'AI Assistant', icon: Sparkles },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/settings/defaults', label: 'Document defaults', icon: SlidersHorizontal },
  { href: '/settings/branding', label: 'Branding & templates', icon: Palette },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const;

/** Mobile gets the five things you reach for mid-job. */
const MOBILE_NAV = NAV.filter((item) =>
  ['/dashboard', '/quotations', '/invoices', '/customers', '/settings'].includes(item.href),
);

// '/settings/defaults' and '/settings/branding' get their own top-level nav
// entries below, so the generic '/settings' entry's prefix match must not
// also light up on those two pages — otherwise two items highlight at once.
const SETTINGS_SUB_NAV_PROMOTED = ['/settings/defaults', '/settings/branding'];

function isActive(pathname: string, href: string): boolean {
  if (href === '/settings' && SETTINGS_SUB_NAV_PROMOTED.some((path) => pathname.startsWith(path))) {
    return false;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ usage, businessName }: { usage: UsageSnapshot; businessName: string }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-muted/25 md:flex">
      <div className="flex h-16 items-center gap-2.5 border-b border-border px-5">
        <InvoraMark className="h-7 w-7" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">Invora</p>
          <p className="truncate text-[11px] leading-tight text-muted-foreground">{businessName}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3" aria-label="Sections">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-background/70 hover:text-foreground',
              )}
            >
              <item.icon className={cn('h-4 w-4', active && 'text-primary')} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <UsageMeter usage={usage} />
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-background/95 backdrop-blur md:hidden"
      aria-label="Sections"
    >
      {MOBILE_NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors',
              active ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
