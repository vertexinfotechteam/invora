import { PageHeaderSkeleton, TableSkeleton } from '@/components/ui/states';

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <TableSkeleton rows={8} columns={4} />
      <TableSkeleton rows={5} columns={3} />
    </div>
  );
}
