import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/common/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { SiteFooter } from "@/components/layout/SiteFooter";

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 glass-panel border-b">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/">
            <Logo />
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <Link to="/about" className="hover:text-foreground transition-colors">
              About
            </Link>
            <Link to="/contact" className="hover:text-foreground transition-colors">
              Contact
            </Link>
            <Link to="/faq" className="hover:text-foreground transition-colors">
              FAQ
            </Link>
          </nav>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <Link to="/auth">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="sm" className="gap-1.5">
                Get started <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <SiteFooter />
    </div>
  );
}
