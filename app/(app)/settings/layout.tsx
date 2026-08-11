import Link from 'next/link';
import { PageHeader } from '@/components/app/page-header';
import { SettingsNav } from '@/components/app/settings-nav';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader title="Settings" description="Your business, your defaults, your plan." />
      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <SettingsNav />
        <div className="min-w-0 max-w-3xl">{children}</div>
      </div>
      <p className="mt-10 text-xs text-muted-foreground">
        Need something that is not here?{' '}
        <Link href="mailto:support@invora.app" className="text-primary underline-offset-4 hover:underline">
          Tell us
        </Link>
        .
      </p>
    </>
  );
}
