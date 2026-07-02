import { format } from "date-fns";
import { Check, CheckCheck, Pin, PinOff, Paperclip, FileText, Download } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ReactionPicker } from "./ReactionPicker";

export type Attachment = { url: string; name: string; type: string; size: number };
export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  attachments: Attachment[];
  created_at: string;
  read_at: string | null;
  pinned: boolean;
};
export type ReactionRow = { id: string; message_id: string; user_id: string; emoji: string };

export function MessageBubble({
  msg,
  mine,
  reactions,
  currentUserId,
  onReact,
  onUnreact,
  onTogglePin,
  isOwnerAction,
}: {
  msg: MessageRow;
  mine: boolean;
  reactions: ReactionRow[];
  currentUserId: string;
  onReact: (messageId: string, emoji: string) => void;
  onUnreact: (reactionId: string) => void;
  onTogglePin: (messageId: string, pinned: boolean) => void;
  isOwnerAction: boolean;
}) {
  const grouped = reactions.reduce<Record<string, ReactionRow[]>>((acc, r) => {
    (acc[r.emoji] ||= []).push(r);
    return acc;
  }, {});

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={cn("group flex flex-col", mine ? "items-end" : "items-start")}
    >
      <div className={cn("flex items-end gap-2 max-w-[80%]", mine && "flex-row-reverse")}>
        <div
          className={cn(
            "relative rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
            mine
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-secondary text-foreground rounded-bl-md",
            msg.pinned && "ring-1 ring-amber-500/50",
          )}
        >
          {msg.pinned && (
            <div className={cn("absolute -top-2", mine ? "left-2" : "right-2")}>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/90 text-white text-[10px] px-1.5 py-0.5 font-medium">
                <Pin className="h-2.5 w-2.5" /> Pinned
              </span>
            </div>
          )}
          {msg.body && <p className="whitespace-pre-wrap break-words">{msg.body}</p>}
          {msg.attachments?.length > 0 && (
            <div className={cn("space-y-2", msg.body && "mt-2")}>
              {msg.attachments.map((a, i) => {
                const isImage = a.type.startsWith("image/");
                return isImage ? (
                  <a key={i} href={a.url} target="_blank" rel="noreferrer" className="block">
                    <img
                      src={a.url}
                      alt={a.name}
                      className="rounded-lg max-h-72 max-w-full object-cover border border-border/40"
                    />
                  </a>
                ) : (
                  <a
                    key={i}
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-xs",
                      mine ? "bg-primary-foreground/10" : "bg-background/60",
                    )}
                  >
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="flex-1 truncate font-medium">{a.name}</span>
                    <Download className="h-3.5 w-3.5 opacity-70" />
                  </a>
                );
              })}
            </div>
          )}
          <div
            className={cn(
              "mt-1 flex items-center gap-1 text-[10px]",
              mine ? "text-primary-foreground/70 justify-end" : "text-muted-foreground",
            )}
          >
            <span>{format(new Date(msg.created_at), "h:mm a")}</span>
            {mine && (
              msg.read_at ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />
            )}
          </div>
        </div>
        <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
          <ReactionPicker onPick={(e) => onReact(msg.id, e)} align={mine ? "end" : "start"} />
          {isOwnerAction && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
              onClick={() => onTogglePin(msg.id, !msg.pinned)}
              title={msg.pinned ? "Unpin" : "Pin"}
            >
              {msg.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            </Button>
          )}
        </div>
      </div>
      {Object.keys(grouped).length > 0 && (
        <div className={cn("mt-1 flex flex-wrap gap-1", mine ? "justify-end" : "justify-start")}>
          {Object.entries(grouped).map(([emoji, rs]) => {
            const own = rs.find((r) => r.user_id === currentUserId);
            return (
              <button
                key={emoji}
                onClick={() =>
                  own ? onUnreact(own.id) : onReact(msg.id, emoji)
                }
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
                  own
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-border bg-background hover:bg-secondary",
                )}
              >
                <span>{emoji}</span>
                <span className="tabular-nums text-[10px] text-muted-foreground">{rs.length}</span>
              </button>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
