'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/#product', label: 'Product' },
  { href: '/#ai', label: 'AI' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/#faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' },
];

export function MarketingNav() {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  // Clicking "Home" or the logo should always land back on the hero. Next.js
  // Link only navigates — it does not scroll — so when we are already on `/`
  // (nothing to navigate to) we scroll there ourselves instead.
  function goHome(event: React.MouseEvent<HTMLAnchorElement>) {
    if (pathname === '/') {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setOpen(false);
  }

  return (
    <header className="marketing-nav-surface sticky top-0 z-40 w-full border-b border-border/70 backdrop-blur-md">
      <nav className="container flex h-16 items-center justify-between" aria-label="Main">
        <Link href="/" onClick={goHome} className="flex items-center gap-2.5">
          <InvoraMark />
          <span className="font-wordmark text-[17px] font-semibold tracking-tight">Invora</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={link.href === '/' ? goHome : undefined}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/signup">Start free</Link>
          </Button>
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <button
            type="button"
            className="rounded-md p-2 text-muted-foreground"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      <div className={cn('border-t border-border md:hidden', open ? 'block' : 'hidden')}>
        <div className="container flex flex-col gap-1 py-3">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={link.href === '/' ? goHome : () => setOpen(false)}
              className="rounded-md px-2 py-2.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-2 flex gap-2">
            <Button asChild variant="outline" className="flex-1">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild className="flex-1">
              <Link href="/signup">Start free</Link>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

export function InvoraMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo-mark.png"
      // Decorative: the "Invora" text beside it carries the name, so announcing
      // the image too would just repeat it.
      alt=""
      aria-hidden
      className={cn('h-8 w-8 shrink-0 object-contain', className)}
    />
  );
}
