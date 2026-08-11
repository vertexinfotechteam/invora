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
      { href: 'https://vertexinfotech.example', label: 'Vertex Infotech' },
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
    <footer className="border-t border-border bg-muted/30">
      <div className="container grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <InvoraMark />
            <span className="text-[17px] font-semibold tracking-tight">Invora</span>
          </div>
          <p className="max-w-xs text-sm text-muted-foreground">
            Quotations, invoices and payments for service businesses — with an AI assistant that
            drafts the words and never touches the numbers.
          </p>
          <p className="text-xs text-muted-foreground">
            A product by <span className="font-medium text-foreground">Vertex Infotech</span>.
          </p>
        </div>

        {COLUMNS.map((column) => (
          <div key={column.title} className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {column.title}
            </h3>
            <ul className="space-y-2">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-border">
        <div className="container flex flex-col items-center justify-between gap-2 py-5 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} Vertex Infotech. All rights reserved.</p>
          <p>Payments processed securely by Razorpay. GST-ready documents.</p>
        </div>
      </div>
    </footer>
  );
}
