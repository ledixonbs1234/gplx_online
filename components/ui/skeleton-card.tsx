import { cn } from '@/lib/utils';

interface SkeletonCardProps {
  className?: string;
}

export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div className={cn('rounded-2xl glass p-5', className)}>
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-xl shimmer" />
        <div className="w-16 h-6 rounded-full shimmer" />
      </div>
      <div className="w-24 h-4 rounded shimmer mb-2" />
      <div className="w-20 h-8 rounded shimmer" />
    </div>
  );
}

export function SkeletonChart({ className }: SkeletonCardProps) {
  return (
    <div className={cn('rounded-2xl glass p-6', className)}>
      <div className="w-48 h-6 rounded shimmer mb-6" />
      <div className="flex items-end justify-between gap-2 h-48">
        {[40, 65, 45, 80, 55, 70, 60, 85, 50, 75, 65, 90].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t shimmer"
            style={{ height: `${h}%`, animationDelay: `${i * 0.1}s` }}
          />
        ))}
      </div>
    </div>
  );
}