import Link from 'next/link';
import { InvoraMark } from '@/components/marketing/nav';

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { href: '/#product', label: 'Overview' },
      { href: '/#ai', label: 'AI assistant' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/signup', label: 'Start free' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: 'https://vertexinfotech.vercel.app', label: 'Vertex Infotech' },
      { href: '/#faq', label: 'FAQ' },
      { href: '/contact', label: 'Contact support' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/terms', label: 'Terms of service' },
      { href: '/privacy', label: 'Privacy policy' },
      { href: '/refunds', label: 'Refunds & cancellation' },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-navy-900 bg-navy-950 text-navy-300">
      <div className="container grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            {/* The brand mark's letterform is deep navy, which all but vanishes
                against this footer's near-black. A light tile gives it the pale
                ground it was drawn for; every other placement sits on cream and
                needs no such help. */}
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy-50">
              <InvoraMark className="h-7 w-7" />
            </span>
            <span className="font-wordmark text-[17px] font-semibold tracking-tight text-white">
              Invora
            </span>
          </div>
          <p className="max-w-xs text-sm text-navy-400">
            Quotations, invoices and payments for service businesses — with an AI assistant that
            drafts the words and never touches the numbers.
          </p>
          <p className="text-xs text-navy-400">
            A product by <span className="font-medium text-navy-200">Vertex Infotech</span>.
          </p>
        </div>

        {COLUMNS.map((column) => (
          <div key={column.title} className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-navy-400">
              {column.title}
            </h3>
            <ul className="space-y-2">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-navy-300 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-navy-900">
        <div className="container flex flex-col items-center justify-center gap-2 py-5 text-center text-xs text-navy-400">
          <p>© {new Date().getFullYear()} Vertex Infotech. All rights reserved.</p>
          <p>Payments processed securely by Razorpay. GST-ready documents.</p>
          <p>
            <a
              href="https://vertexinfotech.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-navy-300 underline-offset-4 transition-colors hover:text-white hover:underline"
            >
              vertexinfotech.vercel.app
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
