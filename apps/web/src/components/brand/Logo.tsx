import { cn } from "@/lib/utils";

/**
 * Tudumm brand mark — a funnel with a qualified lead dropping through.
 * Represents the core flow: scrape many → qualify → convert.
 * Inherits color via `currentColor` (white on the violet logo square).
 */
export function TudummMark({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* funnel */}
      <path d="M5 4h14l-5 6.5V16l-4 2v-7.5L5 4Z" />
      {/* qualified lead dropping out */}
      <circle cx="12" cy="21" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Full logo: the violet gradient square containing the funnel mark.
 * `size` controls the square; the mark scales inside.
 */
export function TudummLogo({ className, size = "h-10 w-10" }: { className?: string; size?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white",
        size,
        className
      )}
    >
      <TudummMark className="h-1/2 w-1/2" />
    </div>
  );
}
