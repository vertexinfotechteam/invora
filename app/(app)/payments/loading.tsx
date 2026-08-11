import { CardsSkeleton, PageHeaderSkeleton, TableSkeleton } from '@/components/ui/states';

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <CardsSkeleton count={3} />
      <TableSkeleton rows={8} columns={5} />
    </div>
  );
}
