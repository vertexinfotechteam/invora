import { MarketingNav } from '@/components/marketing/nav';
import { MarketingFooter } from '@/components/marketing/footer';
import { ChatWidget } from '@/components/marketing/chat-widget';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* Reveal (components/marketing/reveal.tsx) ships every wrapped section
          hidden (opacity-0) until an IntersectionObserver flips it visible —
          with no JS running, nothing ever does. This forces the visible end
          state for visitors, crawlers, and slow-hydration windows with no
          script execution. */}
      <noscript>
        <style>{'[data-reveal]{opacity:1 !important;transform:none !important;}'}</style>
      </noscript>
      <MarketingNav />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
      <ChatWidget />
    </div>
  );
}
