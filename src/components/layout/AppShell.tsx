import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";
import { MobileNav } from "./MobileNav";
import { CommandPalette } from "./CommandPalette";
import { GlobalMessageSearch } from "@/components/messaging/GlobalMessageSearch";
import { PageTransition } from "@/components/common/PageTransition";

export function AppShell({ children }: { children: ReactNode }) {
  const [msgSearchOpen, setMsgSearchOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setMsgSearchOpen((v) => !v);
      }
    };
    const onOpen = () => setMsgSearchOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("brandbridge:open-message-search", onOpen as EventListener);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("brandbridge:open-message-search", onOpen as EventListener);
    };
  }, []);

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopNav />
        <main className="flex-1 px-4 sm:px-6 md:px-10 py-6 md:py-10 pb-24 md:pb-10 max-w-[1400px] w-full mx-auto">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      <MobileNav />
      <CommandPalette />
      <GlobalMessageSearch open={msgSearchOpen} onOpenChange={setMsgSearchOpen} />
    </div>
  );
}
