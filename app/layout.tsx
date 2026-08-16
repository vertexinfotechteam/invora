import type { Metadata, Viewport } from 'next';
import { Inter, Fraunces, Plus_Jakarta_Sans } from 'next/font/google';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/theme-provider';
import { cn } from '@/lib/utils';
import './globals.css';
import { appUrl as siteUrl } from '@/lib/app-url';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-serif',
  weight: ['500', '600'],
  display: 'swap',
});
// Instagram Sans itself is Meta's unlicensed in-house font, so this stands in
// for it on the "Invora" wordmark — closest freely-licensed match in shape
// (rounded geometric grotesque) and weight.
const wordmark = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-wordmark',
  weight: ['600', '700'],
  display: 'swap',
});

// `||` deliberately, not `??` — an env var that exists on the hosting platform
// but was left blank reads as `''`, which `??` does not treat as absent (it
// only falls back on null/undefined). `new URL('')` throws, and this runs at
// module load for every route, so an empty value here took the whole build
// down. `||` treats the empty string as falsy too, so it's covered either way.
const appUrl = siteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'Invora — AI quotations & invoices for growing businesses',
    template: '%s · Invora',
  },
  description:
    'Invora turns a one-line brief into a client-ready quotation, converts it to an invoice in a click, and chases the payment for you. Built by Vertex Infotech.',
  applicationName: 'Invora',
  authors: [{ name: 'Vertex Infotech' }],
  keywords: [
    'quotation software',
    'invoice software',
    'GST invoice India',
    'AI quotation generator',
    'Razorpay invoicing',
  ],
  openGraph: {
    type: 'website',
    siteName: 'Invora',
    title: 'Invora — AI quotations & invoices',
    description:
      'From brief to quotation to paid invoice. AI-assisted, GST-ready, and built for Indian service businesses.',
    url: appUrl,
    images: [{ url: '/logo.png', width: 1200, height: 630, alt: 'Invora' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Invora — AI quotations & invoices',
    description:
      'From brief to quotation to paid invoice. AI-assisted, GST-ready, and built for Indian service businesses.',
    images: ['/logo.png'],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf8f5' },
    { media: '(prefers-color-scheme: dark)', color: '#1f1c19' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={cn(inter.variable, fraunces.variable, wordmark.variable)}>
      <body>
        <ThemeProvider>
          {children}
          <Toaster
            position="top-right"
            richColors
            closeButton
            toastOptions={{ classNames: { toast: 'text-sm' } }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
