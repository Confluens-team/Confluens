import { cn } from '@/lib/utils';

// Isotipo de Confluens (la "C" de cauces que confluyen), recortado del logo oficial del equipo.
export function ConfluensMarca({ className }: { className?: string }) {
  return (
    <img
      src="/confluens-isotipo.png"
      alt=""
      width={20}
      height={20}
      className={cn('size-5', className)}
      aria-hidden
    />
  );
}
