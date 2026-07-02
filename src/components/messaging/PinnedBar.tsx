import { Pin, ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { MessageRow } from "./MessageBubble";

export function PinnedBar({
  pinned,
  onJump,
}: {
  pinned: MessageRow[];
  onJump: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!pinned.length) return null;
  const first = pinned[0];
  return (
    <div className="border-b border-border bg-amber-500/5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-amber-500/10 transition-colors"
      >
        <Pin className="h-3.5 w-3.5 text-amber-600" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-500 font-medium">
            Pinned · {pinned.length}
          </p>
          <p className="text-xs truncate">{first.body || "(attachment)"}</p>
        </div>
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="max-h-56 overflow-y-auto border-t border-amber-500/20">
          {pinned.map((m) => (
            <button
              key={m.id}
              onClick={() => onJump(m.id)}
              className="w-full text-left px-4 py-2 border-b border-amber-500/10 hover:bg-amber-500/10 transition-colors"
            >
              <p className="text-xs truncate">{m.body || "(attachment)"}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
