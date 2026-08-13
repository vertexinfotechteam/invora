import type { Metadata } from 'next';
import { requireBusiness } from '@/lib/guards/auth';
import { ProfileForm } from '@/components/app/settings-forms';
import { ProfileCompleteness } from '@/components/app/profile-completeness';
import { DeleteAccountDialog } from '@/components/app/delete-account-dialog';

export const metadata: Metadata = { title: 'Business profile' };
export const dynamic = 'force-dynamic';

export default async function ProfileSettingsPage() {
  const { business } = await requireBusiness();

  return (
    <div className="space-y-6">
      <ProfileCompleteness business={business} />
      <ProfileForm business={business} />
      <DeleteAccountDialog confirmPhrase={business.name?.trim() || 'DELETE'} />
    </div>
  );
}
