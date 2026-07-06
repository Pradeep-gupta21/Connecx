import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  Building2,
  Zap,
  MessagesSquare,
  ShieldCheck,
  BarChart3,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/common/Logo";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { AnimatedNumber } from "@/components/common/AnimatedNumber";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BrandBridge — Where brands meet creators" },
      {
        name: "description",
        content:
          "The calm, professional marketplace for advertisers and content creators. Launch campaigns, review pitches, and message collaborators — all in one place.",
      },
      { property: "og:title", content: "BrandBridge — Where brands meet creators" },
      {
        property: "og:description",
        content:
          "Launch campaigns, discover vetted creators, and collaborate in real time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [user, loading, navigate]);

  const fadeUp = {
    initial: { opacity: 0, y: reduce ? 0 : 14 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-80px" },
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-40 glass-panel border-b">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo />
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#for-brands" className="hover:text-foreground transition-colors">For brands</a>
            <a href="#for-creators" className="hover:text-foreground transition-colors">For creators</a>
          </nav>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <Link to="/auth">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link to="/auth">
              <Button size="sm" className="gap-1.5">
                Get started <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Ambient background */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 grid-bg opacity-70" />
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[520px] w-[860px] blob rounded-full bg-accent/25" />
          <div className="absolute top-40 right-[-10%] h-[380px] w-[380px] blob rounded-full bg-chart-2/20" />
        </div>

        <div className="max-w-6xl mx-auto px-6 pt-24 pb-24 md:pt-36 md:pb-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-3xl"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 backdrop-blur px-3 py-1 text-xs text-muted-foreground">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-70" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent" />
              </span>
              Now in early access · Invite-only pricing
            </div>
            <h1 className="mt-6 font-display text-5xl md:text-7xl font-semibold tracking-tight leading-[1.02]">
              Where brands meet
              <br />
              <span className="text-gradient">the right creators.</span>
            </h1>
            <p className="mt-7 text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed">
              BrandBridge is the calm, professional marketplace for advertisers and content
              creators. Launch campaigns, review pitches, and message collaborators — all in
              one place.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link to="/auth">
                <Button size="lg" className="gap-2 h-12 px-6 text-base">
                  Start free <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="#how">
                <Button size="lg" variant="outline" className="h-12 px-6 text-base">
                  See how it works
                </Button>
              </a>
            </div>
            <p className="mt-6 text-xs text-muted-foreground">
              No credit card required · Free for creators, always
            </p>
          </motion.div>

          {/* Stat strip */}
          <motion.div {...fadeUp} className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10">
            {[
              { n: 2400, suffix: "+", label: "Vetted creators" },
              { n: 180, suffix: "+", label: "Active campaigns" },
              { n: 96, suffix: "%", label: "Reply rate in 24h" },
              { n: 12, suffix: "M+", label: "Combined reach" },
            ].map((s) => (
              <div key={s.label} className="border-l border-border/60 pl-4 md:pl-6">
                <div className="font-display text-3xl md:text-4xl font-semibold tracking-tight">
                  <AnimatedNumber value={s.n} />
                  {s.suffix}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-border/60 bg-surface/40">
        <div className="max-w-6xl mx-auto px-6 py-24 md:py-28">
          <motion.div {...fadeUp} className="max-w-2xl">
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              How it works
            </p>
            <h2 className="mt-3 font-display text-3xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
              One workflow. <span className="text-muted-foreground">Both sides of the table.</span>
            </h2>
          </motion.div>

          <div className="mt-14 grid md:grid-cols-3 gap-5">
            {[
              {
                icon: Building2,
                step: "01",
                title: "Post your brief",
                body: "Advertisers publish campaigns in minutes — budget, deliverables, audience. Set it live in one click.",
              },
              {
                icon: Sparkles,
                step: "02",
                title: "Discover creators",
                body: "Browse vetted profiles by category, audience, and rate. Save lists and shortlist your favorites.",
              },
              {
                icon: Zap,
                step: "03",
                title: "Collaborate in real time",
                body: "Pitch, accept, and message — all in one inbox. Realtime updates so nothing slips through.",
              },
            ].map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.55, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                className="group surface-card p-7 hover:shadow-elevated hover:-translate-y-0.5 transition-all duration-300"
              >
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 rounded-xl bg-foreground text-background flex items-center justify-center transition-transform group-hover:scale-105">
                    <f.icon className="h-4 w-4" />
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">{f.step}</span>
                </div>
                <h3 className="mt-6 font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section id="features" className="border-t border-border/60">
        <div className="max-w-6xl mx-auto px-6 py-24 md:py-28">
          <motion.div {...fadeUp} className="max-w-2xl">
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Every detail, considered
            </p>
            <h2 className="mt-3 font-display text-3xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
              Built like the tools you already love.
            </h2>
            <p className="mt-5 text-muted-foreground leading-relaxed">
              Keyboard-first, blazing fast, and quiet by default. BrandBridge stays out of the
              way so you can focus on the work.
            </p>
          </motion.div>

          <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Search, title: "Precise discovery", body: "Filter by platform, audience, geography, and rate. Save searches and get alerts." },
              { icon: MessagesSquare, title: "Realtime messaging", body: "Threaded conversations with typing, presence, reactions, and pinned updates." },
              { icon: ShieldCheck, title: "Trust & verification", body: "Verified creators, brand approvals, and audit-logged admin actions." },
              { icon: BarChart3, title: "Analytics that matter", body: "Campaign performance, application funnels, and creator earnings in one place." },
              { icon: Zap, title: "Keyboard-first", body: "Command palette, quick nav, and shortcuts for everything you do repeatedly." },
              { icon: Sparkles, title: "Delightful by default", body: "Every interaction motion-tuned. No dark patterns. No feature creep." },
            ].map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: (i % 3) * 0.06, ease: [0.22, 1, 0.36, 1] }}
                className="surface-card p-6 hover:border-foreground/20 transition-colors"
              >
                <f.icon className="h-5 w-5 text-accent" />
                <h3 className="mt-5 font-display text-base font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Split: brands / creators */}
      <section className="border-t border-border/60 bg-surface/40">
        <div className="max-w-6xl mx-auto px-6 py-24 md:py-28 grid md:grid-cols-2 gap-14">
          <motion.div {...fadeUp} id="for-brands">
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">For brands</p>
            <h2 className="mt-3 font-display text-3xl md:text-4xl font-semibold tracking-tight leading-tight">
              Stop chasing creators across five tools.
            </h2>
            <p className="mt-5 text-muted-foreground leading-relaxed">
              Publish a campaign once. Get pitches with context. Accept, message, and track —
              without a single spreadsheet.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              {["Structured briefs with attachments", "Shortlists & saved creators", "Realtime pitch inbox"].map((x) => (
                <li key={x} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                  {x}
                </li>
              ))}
            </ul>
          </motion.div>
          <motion.div {...fadeUp} id="for-creators">
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">For creators</p>
            <h2 className="mt-3 font-display text-3xl md:text-4xl font-semibold tracking-tight leading-tight">
              Real briefs from real brands.
            </h2>
            <p className="mt-5 text-muted-foreground leading-relaxed">
              Build a profile that shows your best work. Apply to campaigns in your niche.
              Talk directly with brands. No middlemen.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              {["Public profile with portfolio", "Transparent pricing tiers", "Direct payment tracking"].map((x) => (
                <li key={x} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                  {x}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/60">
        <div className="max-w-6xl mx-auto px-6 py-24 md:py-28">
          <motion.div
            {...fadeUp}
            className="relative overflow-hidden rounded-3xl border border-border bg-foreground text-background p-10 md:p-16"
          >
            <div aria-hidden className="absolute inset-0 opacity-60 animated-gradient bg-[linear-gradient(120deg,transparent,color-mix(in_oklab,var(--color-accent)_40%,transparent),transparent)]" />
            <div className="relative max-w-2xl">
              <h2 className="font-display text-3xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
                Ready when you are.
              </h2>
              <p className="mt-4 text-background/70 text-lg leading-relaxed">
                Join the early access. Get set up in under two minutes.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/auth">
                  <Button size="lg" variant="secondary" className="h-12 px-6 text-base gap-2">
                    Create your account <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
