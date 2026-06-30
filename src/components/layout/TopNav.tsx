import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationBell } from "./NotificationBell";
import { UserMenu } from "./UserMenu";

export function TopNav() {
  return (
    <header className="h-16 sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-lg">
      <div className="h-full flex items-center gap-3 px-6">
        <WorkspaceSwitcher />

        <button
          onClick={() => {
            const e = new KeyboardEvent("keydown", { key: "k", metaKey: true });
            window.dispatchEvent(e);
          }}
          className="hidden md:flex flex-1 max-w-md items-center gap-2 h-9 px-3 rounded-lg border border-border bg-surface text-sm text-muted-foreground hover:bg-secondary transition-colors"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Search or jump to...</span>
          <kbd className="text-[10px] font-mono rounded border border-border bg-background px-1.5 py-0.5">
            ⌘K
          </kbd>
        </button>

        <div className="flex-1 md:flex-none" />

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <NotificationBell />
          <div className="mx-2 h-6 w-px bg-border" />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
