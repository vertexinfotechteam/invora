'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Scroll-triggered entrance animation for marketing sections.
 *
 * Fires once, the first time the element crosses into view, then
 * disconnects — a reveal that replays every time you scroll past it reads as
 * distracting rather than polished. `prefers-reduced-motion` users get the
 * final state immediately with no transition (handled by `motion-reduce:`).
 */
export function Reveal({
  children,
  className,
  delayMs = 0,
  variant = 'up',
}: {
  children: React.ReactNode;
  className?: string;
  /** Stagger successive items in a grid/list. */
  delayMs?: number;
  variant?: 'up' | 'scale';
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-reveal
      style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
      className={cn(
        'transition-all duration-700 ease-reveal motion-reduce:transition-none motion-reduce:!opacity-100 motion-reduce:!translate-y-0 motion-reduce:!scale-100',
        !visible && (variant === 'scale' ? 'scale-95 opacity-0' : 'translate-y-7 opacity-0'),
        visible && 'translate-y-0 scale-100 opacity-100',
        className,
      )}
    >
      {children}
    </div>
  );
}
