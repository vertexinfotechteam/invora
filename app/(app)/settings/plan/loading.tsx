import { CardsSkeleton, PageHeaderSkeleton } from '@/components/ui/states';

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <CardsSkeleton count={2} />
    </div>
  );
}
