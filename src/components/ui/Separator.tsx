import { cn } from "../../lib/cn";
export function Separator({ className }: { className?: string }) {
  return <div className={cn("shrink-0 bg-border h-px w-full", className)} />;
}
