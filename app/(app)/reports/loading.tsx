import { CardsSkeleton, PageHeaderSkeleton } from '@/components/ui/states';

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <CardsSkeleton count={4} />
      <div className="card-surface space-y-3 p-5">
        <div className="skeleton h-4 w-40" />
        <div className="skeleton h-56 w-full" />
      </div>
    </div>
  );
}
