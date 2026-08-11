import type { Metadata } from 'next';
import { AdminBusinesses } from '@/components/admin/businesses';

export const metadata: Metadata = { title: 'Businesses' };

export default function AdminBusinessesPage() {
  return <AdminBusinesses />;
}
