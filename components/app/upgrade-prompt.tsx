import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * The wall a free-plan user hits on a Premium surface.
 *
 * Note this is a *presentation* of a decision already made on the server — the
 * corresponding route handler refuses the request whether or not this renders.
 */
export function UpgradePrompt({
  title,
  description,
  bullets,
}: {
  title: string;
  description: string;
  bullets?: string[];
}) {
  return (
    <div className="card-surface mx-auto max-w-xl p-8 text-center">
      <div className="mx-auto w-fit rounded-full bg-accent p-3">
        <Sparkles className="h-6 w-6 text-accent-foreground" />
      </div>

      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{description}</p>

      {bullets?.length ? (
        <ul className="mx-auto mt-4 max-w-sm space-y-1.5 text-left text-sm text-muted-foreground">
          {bullets.map((bullet) => (
            <li key={bullet} className="flex gap-2">
              <span className="text-primary">•</span>
              {bullet}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
        <Button asChild>
          <Link href="/settings/plan">Upgrade to Premium</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/pricing">Compare plans</Link>
        </Button>
      </div>
    </div>
  );
}
