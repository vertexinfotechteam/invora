import { PageHeaderSkeleton, TableSkeleton } from '@/components/ui/states';

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="skeleton h-9 w-72" />
      <TableSkeleton rows={8} columns={5} />
    </div>
  );
}
