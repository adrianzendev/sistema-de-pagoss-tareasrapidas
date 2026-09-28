import { Skeleton } from "@/components/ui/skeleton";

export function PaymentsListSkeleton() {
  return (
    <div className="space-y-0 divide-y divide-border">
      {[1, 2, 3].map(i => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          <Skeleton className="h-4 w-6" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-8 rounded-sm" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}
