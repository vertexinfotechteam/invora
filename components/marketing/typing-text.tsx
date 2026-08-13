'use client';

import * as React from 'react';

const TYPE_MS = 65;
const DELETE_MS = 35;
const HOLD_MS = 1800;
const PAUSE_BEFORE_TYPE_MS = 400;

/**
 * Typewriter effect that cycles through `phrases` — types one, holds it,
 * deletes it, types the next.
 *
 * The first phrase is what actually renders in the initial HTML (this is a
 * client component, but its first render before any effect runs is
 * deterministic and matches SSR), so a crawler or a visitor with JS disabled
 * still sees a complete, meaningful heading — the cycling is enhancement,
 * not the only copy of the content. `prefers-reduced-motion` gets the same
 * treatment: the first phrase, static, no cursor animation.
 */
export function TypingText({ phrases, className }: { phrases: string[]; className?: string }) {
  const [text, setText] = React.useState(phrases[0] ?? '');
  const [animate, setAnimate] = React.useState(false);

  React.useEffect(() => {
    if (phrases.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setAnimate(true);

    let phraseIndex = 0;
    // Starts fully typed (matches the phrases[0] already rendered above) and
    // not deleting, so the very first tick's job is just "hold, then start
    // deleting" — the same branch every subsequent full-typed phrase takes.
    let charIndex = phrases[0]?.length ?? 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      const current = phrases[phraseIndex] ?? '';

      if (!deleting) {
        if (charIndex < current.length) {
          charIndex += 1;
          setText(current.slice(0, charIndex));
          timer = setTimeout(tick, TYPE_MS);
        } else {
          deleting = true;
          timer = setTimeout(tick, HOLD_MS);
        }
        return;
      }

      if (charIndex > 0) {
        charIndex -= 1;
        setText(current.slice(0, charIndex));
        timer = setTimeout(tick, DELETE_MS);
      } else {
        phraseIndex = (phraseIndex + 1) % phrases.length;
        deleting = false;
        timer = setTimeout(tick, PAUSE_BEFORE_TYPE_MS);
      }
    };

    timer = setTimeout(tick, HOLD_MS);
    return () => clearTimeout(timer);
  }, [phrases]);

  return (
    <span className={className}>
      {text}
      {animate ? <span className="typing-cursor" aria-hidden /> : null}
    </span>
  );
}
