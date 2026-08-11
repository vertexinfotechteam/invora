import { CardsSkeleton, PageHeaderSkeleton, TableSkeleton } from '@/components/ui/states';

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <CardsSkeleton count={4} />
      <TableSkeleton rows={6} columns={5} />
    </div>
  );
}
