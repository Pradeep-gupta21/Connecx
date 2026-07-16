
import { cn } from "@/lib/utils";

export function Logo({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <a href="/" className={cn("flex items-center gap-2", className)}>
      <div className="h-8 w-8 overflow-hidden rounded-full flex items-center justify-center">
        {/* Light mode logo */}
        <img
          src="/connecx-darkmode.svg"
          alt="Connecx Logo"
          className="block h-full w-full rounded-full object-cover dark:hidden"
        />

        {/* Dark mode logo */}
        <img
          src="/connecx-favicon-3.svg"
          alt="Connecx Logo"
          className="hidden h-full w-full rounded-full object-cover dark:block"
        />
      </div>

      {!compact && (
        <span className="font-display text-[17px] font-semibold tracking-tight">
          <b>ᑕOᑎᑎEᑕ᙭</b>
        </span>
      )}
    </a>
  );
}