import type { Metadata } from 'next';
import { requireBusiness } from '@/lib/guards/auth';
import { getPlanSnapshot } from '@/lib/guards/features';
import { BrandingForm } from '@/components/app/settings-forms';

export const metadata: Metadata = { title: 'Branding & templates' };
export const dynamic = 'force-dynamic';

export default async function BrandingSettingsPage() {
  const { business } = await requireBusiness();
  const plan = await getPlanSnapshot(business.id);

  return <BrandingForm business={business} allowedTemplates={plan.features.templates ?? ['classic']} />;
}
