'use client';

import * as React from 'react';
import { Mail, MessageCircle, Phone, Send, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  failed?: boolean;
}

const GREETING: ChatMessage = {
  role: 'assistant',
  content:
    "Hi! I'm Invora's AI assistant, here 24/7. Ask me about pricing, features, GST invoicing, or how to get started.",
};

const SUGGESTIONS = ['What does Invora do?', 'How much does it cost?', 'Talk to a human'];

/**
 * A support chat bubble for the marketing site. Stateless server-side by
 * design — this component holds the whole conversation and resends the
 * recent turns as `history` on every call, so there is nothing to persist
 * (or leak) between visitors on the backend.
 */
export function ChatWidget() {
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, pending]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(nextMessages);
    setInput('');
    setPending(true);

    try {
      const response = await fetch('/api/ai/support-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          // Last few real turns only — keeps the request small and cheap.
          history: nextMessages.slice(0, -1).slice(-6).map(({ role, content }) => ({ role, content })),
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          response.status === 429
            ? "You're sending messages a bit fast — give it a moment and try again."
            : payload?.error?.message ?? 'Something went wrong. Please try again.';
        setMessages((prev) => [...prev, { role: 'assistant', content: message, failed: true }]);
        return;
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: payload.reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Could not reach the server. Check your connection and try again.',
          failed: true,
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    void send(input);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? 'Close chat' : 'Open chat with Invora Assistant'}
        aria-expanded={open}
        className={cn(
          'fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105 active:scale-95 md:bottom-6 md:right-6',
          open ? 'rotate-0' : '',
        )}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {!open ? (
          <span className="absolute right-0.5 top-0.5 h-3 w-3 rounded-full border-2 border-primary bg-success" />
        ) : null}
      </button>

      <div
        role="dialog"
        aria-modal="false"
        aria-label="Invora Assistant chat"
        className={cn(
          'fixed inset-x-4 bottom-24 z-50 flex max-h-[min(640px,calc(100dvh-7rem))] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl transition-all duration-200 sm:inset-x-auto sm:right-6 sm:w-[380px]',
          open ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0',
        )}
      >
        <header className="flex items-center gap-3 border-b border-border bg-navy-900 px-4 py-3.5 text-white">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10">
            <Sparkles className="h-4.5 w-4.5 text-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Invora Assistant</p>
            <p className="flex items-center gap-1.5 text-xs text-navy-300">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Online · AI-powered · 24/7
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close chat"
            className="rounded-md p-1.5 text-navy-300 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-muted/20 px-4 py-4">
          {messages.map((msg, index) => (
            <MessageBubble key={index} message={msg} />
          ))}
          {pending ? <TypingBubble /> : null}

          {messages.length === 1 ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void send(suggestion)}
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="border-t border-border bg-background px-4 py-2">
          <p className="mb-2 text-[11px] text-muted-foreground">
            Prefer a human?{' '}
            <a href="mailto:vertexinfotech.team@gmail.com" className="inline-flex items-center gap-1 font-medium text-foreground hover:text-primary">
              <Mail className="h-3 w-3" />
              Email
            </a>
            {' · '}
            <a href="tel:+919274240911" className="inline-flex items-center gap-1 font-medium text-foreground hover:text-primary">
              <Phone className="h-3 w-3" />
              +91 92742 40911
            </a>
            {' · '}
            <a href="tel:+917016266727" className="font-medium text-foreground hover:text-primary">
              +91 70162 66727
            </a>
          </p>

          <form onSubmit={onSubmit} className="flex items-center gap-2">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about pricing, features…"
              aria-label="Message"
              maxLength={800}
              disabled={pending}
              className="h-10 flex-1 rounded-full border border-input bg-background px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={pending || !input.trim()}
              aria-label="Send message"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'rounded-br-sm bg-primary text-primary-foreground'
            : message.failed
              ? 'rounded-bl-sm border border-destructive/30 bg-destructive/5 text-destructive'
              : 'rounded-bl-sm border border-border bg-background text-foreground',
        )}
      >
        {message.content}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-border bg-background px-4 py-3">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50"
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
