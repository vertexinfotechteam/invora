import type { Metadata } from 'next';
import { requireBusiness } from '@/lib/guards/auth';
import { DefaultsForm } from '@/components/app/settings-forms';

export const metadata: Metadata = { title: 'Document defaults' };
export const dynamic = 'force-dynamic';

export default async function DefaultsSettingsPage() {
  const { business } = await requireBusiness();
  return <DefaultsForm business={business} />;
}
