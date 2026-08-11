import type { Metadata } from 'next';
import Link from 'next/link';
import { InvoraMark } from '@/components/marketing/nav';

// Sign-in/sign-up/reset forms have no unique content for a search result to
// show and would just compete with the marketing pages for the same queries.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-10">
        <Link href="/" className="flex w-fit items-center gap-2.5">
          <InvoraMark />
          <span className="text-[17px] font-semibold tracking-tight">Invora</span>
        </Link>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          A product by Vertex Infotech ·{' '}
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>{' '}
          ·{' '}
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
        </p>
      </div>

      {/* Decorative panel. Hidden below lg so the form owns small screens. */}
      <aside className="relative hidden overflow-hidden bg-navy-900 lg:block">
        <div className="relative flex h-full flex-col justify-center px-14">
          <blockquote className="max-w-md">
            <p className="text-2xl font-medium leading-snug text-white">
              “From a one-line brief to a client-ready quotation — with every rupee of the
              arithmetic still under your control.”
            </p>
            <footer className="mt-6 text-sm text-navy-300">
              Invora — quotations, invoices and payments, built by Vertex Infotech.
            </footer>
          </blockquote>

          <dl className="mt-14 grid max-w-md grid-cols-3 gap-6 border-t border-white/10 pt-8">
            {[
              { value: 'Paise', label: 'Integer money, never floats' },
              { value: 'RLS', label: 'Tenant isolation in the database' },
              { value: 'Webhook', label: 'The only thing that marks paid' },
            ].map((stat) => (
              <div key={stat.value}>
                <dt className="text-lg font-semibold text-white">{stat.value}</dt>
                <dd className="mt-1 text-xs leading-relaxed text-navy-400">{stat.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </aside>
    </div>
  );
}
