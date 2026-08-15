'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, LogOut, Plus, Search, Settings, ShieldCheck, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { initials } from '@/lib/utils';

const QUICK_CREATE = [
  { href: '/quotations/new', label: 'New quotation' },
  { href: '/invoices/new', label: 'New invoice' },
  { href: '/customers/new', label: 'New customer' },
  { href: '/products/new', label: 'New catalog item' },
];

export function Topbar({
  userEmail,
  userName,
  isAdmin,
}: {
  userEmail: string;
  userName: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [signingOut, setSigningOut] = React.useState(false);
  const searchRef = React.useRef<HTMLInputElement>(null);

  /**
   * Deliberately not a nested <form method="post"> inside DropdownMenu.Item —
   * Radix intercepts the item's select event and can close (unmount) the
   * portal before a nested form's native submit fires, so the request never
   * goes out. A full navigation afterwards, not router.refresh(), because the
   * whole point is to drop every client-side bit of the now-stale session.
   */
  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await fetch('/api/auth/signout', { method: 'POST' });
    } finally {
      window.location.assign('/');
    }
  }

  // "/" focuses search, the way every tool that respects your hands does.
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === '/' && !isTypingTarget(event.target)) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function onSearch(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed) router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur md:px-6">
      <form onSubmit={onSearch} className="relative flex-1 md:max-w-md" role="search">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search customers, quotations, invoices…"
          aria-label="Search"
          className="pl-9 pr-10"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:block">
          /
        </kbd>
      </form>

      <div className="ml-auto flex items-center gap-2">

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Create</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-70" />
            </Button>
          </DropdownMenu.Trigger>
          <Menu align="end">
            {QUICK_CREATE.map((item) => (
              <DropdownMenu.Item key={item.href} asChild>
                <Link href={item.href} className={itemClass}>
                  {item.label}
                </Link>
              </DropdownMenu.Item>
            ))}
          </Menu>
        </DropdownMenu.Root>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-900 text-xs font-semibold text-white"
              aria-label="Account menu"
            >
              {initials(userName || userEmail)}
            </button>
          </DropdownMenu.Trigger>
          <Menu align="end">
            <div className="px-2 py-1.5">
              <p className="truncate text-sm font-medium">{userName || 'Your account'}</p>
              <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
            </div>
            <DropdownMenu.Separator className="my-1 h-px bg-border" />
            <DropdownMenu.Item asChild>
              <Link href="/settings/profile" className={itemClass}>
                <User className="h-4 w-4" />
                Business profile
              </Link>
            </DropdownMenu.Item>
            <DropdownMenu.Item asChild>
              <Link href="/settings/plan" className={itemClass}>
                <Settings className="h-4 w-4" />
                Plan & usage
              </Link>
            </DropdownMenu.Item>
            {isAdmin ? (
              <DropdownMenu.Item asChild>
                <Link href="/admin" className={itemClass}>
                  <ShieldCheck className="h-4 w-4" />
                  Admin panel
                </Link>
              </DropdownMenu.Item>
            ) : null}
            <DropdownMenu.Separator className="my-1 h-px bg-border" />
            <DropdownMenu.Item
              onSelect={() => void signOut()}
              disabled={signingOut}
              className={`${itemClass} text-destructive`}
            >
              <LogOut className="h-4 w-4" />
              {signingOut ? 'Signing out…' : 'Sign out'}
            </DropdownMenu.Item>
          </Menu>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}

const itemClass =
  'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-secondary';

function Menu({ children, align }: { children: React.ReactNode; align: 'start' | 'end' }) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={6}
        className="z-50 min-w-[13rem] rounded-lg border border-border bg-popover p-1 shadow-lg"
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable
  );
}
