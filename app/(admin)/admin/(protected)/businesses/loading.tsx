import { PageHeaderSkeleton, TableSkeleton } from '@/components/ui/states';

export default function Loading() {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton />
      <TableSkeleton rows={6} columns={5} />
    </div>
  );
}
