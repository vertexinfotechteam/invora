import { CardsSkeleton, PageHeaderSkeleton } from '@/components/ui/states';

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <CardsSkeleton count={4} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <div className="card-surface space-y-3 p-5">
            <div className="skeleton h-4 w-40" />
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="skeleton h-10 w-full" />
            ))}
          </div>
          <div className="card-surface space-y-3 p-5">
            <div className="skeleton h-4 w-40" />
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="skeleton h-10 w-full" />
            ))}
          </div>
        </div>
        <div className="card-surface space-y-3 p-5">
          <div className="skeleton h-4 w-32" />
          <div className="skeleton h-2 w-full" />
          <div className="skeleton h-16 w-full" />
        </div>
      </div>
    </div>
  );
}
