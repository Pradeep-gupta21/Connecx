import { useState } from "react";
import { Smile } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const QUICK = ["👍", "❤️", "🔥", "🎉", "😂", "😮", "😢", "🙏", "👏", "🚀", "✅", "💡"];

export function ReactionPicker({
  onPick,
  align = "start",
  className,
}: {
  onPick: (emoji: string) => void;
  align?: "start" | "center" | "end";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-7 w-7 rounded-full text-muted-foreground hover:text-foreground", className)}
        >
          <Smile className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-auto p-2">
        <div className="grid grid-cols-6 gap-1">
          {QUICK.map((e) => (
            <button
              key={e}
              onClick={() => {
                onPick(e);
                setOpen(false);
              }}
              className="h-8 w-8 rounded-md text-lg hover:bg-secondary transition-colors"
            >
              {e}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
