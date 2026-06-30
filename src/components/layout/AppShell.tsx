import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";
import { CommandPalette } from "./CommandPalette";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopNav />
        <main className="flex-1 px-6 md:px-10 py-8 md:py-10 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
