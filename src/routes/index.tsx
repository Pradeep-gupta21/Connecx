import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, Sparkles, Building2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/common/Logo";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BrandBridge — Where brands meet creators" },
      {
        name: "description",
        content:
          "The marketplace built for advertisers and content creators. Launch campaigns, find collaborators, and ship work that performs.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo />
          <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
            <a href="#how" className="hover:text-foreground">How it works</a>
            <a href="#for-brands" className="hover:text-foreground">For brands</a>
            <a href="#for-creators" className="hover:text-foreground">For creators</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to="/auth">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link to="/auth">
              <Button size="sm">Get started</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="relative">
        <div className="max-w-6xl mx-auto px-6 pt-24 pb-20 md:pt-32 md:pb-28">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Now in early access
            </div>
            <h1 className="mt-6 font-display text-5xl md:text-7xl font-semibold tracking-tight leading-[1.05]">
              Where brands meet
              <br />
              <span className="text-muted-foreground">the right creators.</span>
            </h1>
            <p className="mt-7 text-lg text-muted-foreground max-w-xl leading-relaxed">
              BrandBridge is the calm, professional marketplace for advertisers and content
              creators. Launch campaigns, review pitches, and message collaborators — all in one
              place.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link to="/auth">
                <Button size="lg" className="gap-2">
                  Start free <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="#how">
                <Button size="lg" variant="outline">See how it works</Button>
              </a>
            </div>
            <div className="mt-10 flex items-center gap-6 text-xs text-muted-foreground">
              <span>Trusted by independent brands and creators worldwide</span>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="border-t border-border/60 bg-surface/50">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="max-w-2xl">
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">How it works</p>
            <h2 className="mt-3 font-display text-3xl md:text-4xl font-semibold tracking-tight">
              One workflow. Both sides of the table.
            </h2>
          </div>
          <div className="mt-14 grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Building2,
                title: "Post your brief",
                body: "Advertisers create campaigns in minutes — budget, deliverables, audience. Set it live in one click.",
              },
              {
                icon: Sparkles,
                title: "Discover creators",
                body: "Browse vetted profiles by category, audience, and rate. Save lists and shortlist your favorites.",
              },
              {
                icon: Zap,
                title: "Collaborate in real time",
                body: "Pitch, accept, and message — all in one inbox. Realtime updates so nothing slips through.",
              },
            ].map((f) => (
              <div key={f.title} className="surface-card p-7 hover:shadow-elevated transition-all">
                <div className="h-10 w-10 rounded-lg bg-foreground text-background flex items-center justify-center">
                  <f.icon className="h-4 w-4" />
                </div>
                <h3 className="mt-6 font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="for-brands" className="border-t border-border/60">
        <div className="max-w-6xl mx-auto px-6 py-24 grid md:grid-cols-2 gap-16">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">For brands</p>
            <h2 className="mt-3 font-display text-3xl md:text-4xl font-semibold tracking-tight">
              Stop chasing creators across five tools.
            </h2>
            <p className="mt-5 text-muted-foreground leading-relaxed">
              Publish a campaign once. Get pitches with context. Accept, message, and track —
              without a single spreadsheet.
            </p>
          </div>
          <div id="for-creators">
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">For creators</p>
            <h2 className="mt-3 font-display text-3xl md:text-4xl font-semibold tracking-tight">
              Real briefs from real brands.
            </h2>
            <p className="mt-5 text-muted-foreground leading-relaxed">
              Build a profile that shows your best work. Apply to campaigns in your niche. Talk
              directly with brands. No middlemen.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <Logo compact />
          <p>© {new Date().getFullYear()} BrandBridge. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
