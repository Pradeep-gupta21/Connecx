import { useRef, useState } from "react";
import { Paperclip, Image as ImageIcon, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Attachment } from "./MessageBubble";

export function AttachmentPicker({
  conversationId,
  pending,
  setPending,
}: {
  conversationId: string;
  pending: Attachment[];
  setPending: (a: Attachment[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    const results: Attachment[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 25 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 25MB`);
        continue;
      }
      const key = `${conversationId}/${crypto.randomUUID()}-${file.name}`;
      const { error } = await supabase.storage.from("message-attachments").upload(key, file, {
        contentType: file.type,
      });
      if (error) {
        toast.error(error.message);
        continue;
      }
      const { data: signed } = await supabase.storage
        .from("message-attachments")
        .createSignedUrl(key, 60 * 60 * 24 * 365);
      if (signed?.signedUrl) {
        results.push({ url: signed.signedUrl, name: file.name, type: file.type, size: file.size });
      }
    }
    setPending([...pending, ...results]);
    setUploading(false);
  };

  return (
    <>
      <input
        ref={imageRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => upload(e.target.files)}
      />
      <input ref={fileRef} type="file" multiple hidden onChange={(e) => upload(e.target.files)} />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0"
        onClick={() => imageRef.current?.click()}
        disabled={uploading}
        title="Attach image"
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        title="Attach file"
      >
        <Paperclip className="h-4 w-4" />
      </Button>
    </>
  );
}

export function PendingAttachments({
  attachments,
  onRemove,
}: {
  attachments: Attachment[];
  onRemove: (i: number) => void;
}) {
  if (!attachments.length) return null;
  return (
    <div className="flex flex-wrap gap-2 border-t border-border px-3 pt-2">
      {attachments.map((a, i) => (
        <div key={i} className="relative rounded-lg border border-border bg-secondary/50 p-1 pr-6">
          {a.type.startsWith("image/") ? (
            <img src={a.url} alt={a.name} className="h-14 w-14 rounded object-cover" />
          ) : (
            <div className="flex items-center gap-1.5 px-2 py-2 text-xs">
              <Paperclip className="h-3.5 w-3.5" />
              <span className="max-w-[140px] truncate">{a.name}</span>
            </div>
          )}
          <button
            onClick={() => onRemove(i)}
            className="absolute right-0.5 top-0.5 rounded-full bg-background/90 p-0.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
