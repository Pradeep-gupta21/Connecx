import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Sparkles,
  ShieldCheck,
  Handshake,
  Rocket,
  Target,
  Eye,
  Heart,
  Users,
  Lock,
  BarChart3,
  ArrowRight,
} from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Us — Connecx" },
      {
        name: "description",
        content:
          "Connecx connects ambitious brands with authentic creators through transparent collaboration, verified profiles, and secure payments.",
      },
      { property: "og:title", content: "About Us — Connecx" },
      {
        property: "og:description",
        content:
          "Learn about Connecx's mission to bridge brands and creators with trust and secure payments.",
      },
    ],
    links: [{ rel: "canonical", href: "/about" }],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 grid-bg opacity-60" />
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-[420px] w-[720px] blob rounded-full bg-accent/20" />
        </div>
        <div className="max-w-4xl mx-auto px-6 pt-20 pb-20 md:pt-28 md:pb-28 text-center">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              About Connecx
            </p>
            <h1 className="mt-4 font-display text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
              Bridging brands and creators —
              <br />
              <span className="text-gradient">the honest way.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Connecx is a modern marketplace where brands discover talented creators, launch
              campaigns with confidence, and pay securely — all in one calm, professional workspace.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Mission */}
      <section className="border-b border-border/60">
        <div className="max-w-4xl mx-auto px-6 py-20 md:py-24">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Our mission
            </p>
            <h2 className="mt-3 font-display text-3xl md:text-4xl font-semibold tracking-tight leading-tight">
              Empower every creator. Elevate every brand.
            </h2>
            <p className="mt-6 text-muted-foreground leading-relaxed">
              The creator economy is one of the fastest growing markets in the world, yet the tools
              connecting brands and creators are still fragmented, opaque, and slow. Connecx exists
              to fix that. We give brands a single place to run campaigns end to end — from
              discovery and pitching to messaging, delivery, and secure payouts — and we give
              creators a fair marketplace with verified opportunities, transparent pricing, and
              on-time payments.
            </p>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b border-border/60 bg-surface/40">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-24">
          <div className="max-w-2xl">
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              How Connecx works
            </p>
            <h2 className="mt-3 font-display text-3xl md:text-4xl font-semibold tracking-tight leading-tight">
              A workflow both sides trust.
            </h2>
          </div>
          <div className="mt-12 grid md:grid-cols-3 gap-5">
            {[
              {
                icon: Rocket,
                step: "01",
                title: "Brands post briefs",
                body: "Advertisers create structured campaigns with budgets, deliverables and audience — live in minutes.",
              },
              {
                icon: Users,
                step: "02",
                title: "Creators apply",
                body: "Verified creators pitch with a portfolio and price. Brands shortlist and message directly.",
              },
              {
                icon: ShieldCheck,
                step: "03",
                title: "Secure campaign payments",
                body: "Advertisers purchase campaigns upfront. Creator earnings are approved for payout only when deliverables are approved.",
              },
            ].map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="surface-card p-7 hover:shadow-elevated hover:-translate-y-0.5 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 rounded-xl bg-foreground text-background flex items-center justify-center">
                    <s.icon className="h-4 w-4" />
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">{s.step}</span>
                </div>
                <h3 className="mt-6 font-display text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why choose */}
      <section className="border-b border-border/60">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-24">
          <div className="max-w-2xl">
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Why choose Connecx
            </p>
            <h2 className="mt-3 font-display text-3xl md:text-4xl font-semibold tracking-tight leading-tight">
              Built on transparency, trust, and secure payments.
            </h2>
          </div>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: ShieldCheck,
                title: "Verified profiles",
                body: "Every creator and brand goes through review. No bots, no fake audiences.",
              },
              {
                icon: Lock,
                title: "Verified payouts",
                body: "Creator payouts are processed after the advertiser approves the deliverables.",
              },
              {
                icon: Sparkles,
                title: "Transparent pricing",
                body: "No hidden fees. Clear commission on every campaign so you know the maths.",
              },
              {
                icon: BarChart3,
                title: "Real analytics",
                body: "Track pitches, conversions, and creator performance in real time.",
              },
              {
                icon: Handshake,
                title: "Direct collaboration",
                body: "Message, negotiate, and finalise without middlemen slowing you down.",
              },
              {
                icon: Heart,
                title: "Human support",
                body: "Real people answering tickets in 24–48 hours — with dispute resolution.",
              },
            ].map((f) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.45 }}
                className="surface-card p-6 hover:border-foreground/20 transition-colors"
              >
                <f.icon className="h-5 w-5 text-accent" />
                <h3 className="mt-4 font-display text-base font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Values & Vision */}
      <section className="border-b border-border/60 bg-surface/40">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-24 grid md:grid-cols-2 gap-12">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
              <Target className="h-3 w-3" /> Our values
            </div>
            <h2 className="mt-4 font-display text-2xl md:text-3xl font-semibold tracking-tight">
              What we stand for.
            </h2>
            <ul className="mt-6 space-y-4 text-sm text-muted-foreground">
              {[
                ["Creator-first", "Fair rates, on-time payouts, and a voice in how the platform evolves."],
                ["Brand accountability", "Verified brands and enforceable rules to keep the marketplace clean."],
                ["Zero dark patterns", "No hidden fees, no forced upsells, no manipulative UX."],
                ["Privacy by default", "We collect only what we need, and never sell your data."],
              ].map(([t, d]) => (
                <li key={t}>
                  <p className="font-medium text-foreground">{t}</p>
                  <p className="mt-1">{d}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
              <Eye className="h-3 w-3" /> Our vision
            </div>
            <h2 className="mt-4 font-display text-2xl md:text-3xl font-semibold tracking-tight">
              A creator economy that works for everyone.
            </h2>
            <p className="mt-6 text-muted-foreground leading-relaxed">
              We imagine a world where a creator in a small town has the same access to global
              brand campaigns as a creator in a metro. A world where brands measure real outcomes,
              not vanity metrics. Connecx is our contribution to that future — one honest
              collaboration at a time.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section>
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-24">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-foreground text-background p-10 md:p-14 text-center">
            <div aria-hidden className="absolute inset-0 opacity-60 animated-gradient bg-[linear-gradient(120deg,transparent,color-mix(in_oklab,var(--color-accent)_40%,transparent),transparent)]" />
            <div className="relative">
              <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-tight">
                Join the movement.
              </h2>
              <p className="mt-3 text-background/70">
                Whether you're a creator or a brand — Connecx is built for you.
              </p>
              <div className="mt-8 flex flex-wrap gap-3 justify-center">
                <Link to="/auth">
                  <Button size="lg" variant="secondary" className="h-12 px-6 text-base gap-2">
                    Create your account <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/contact">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 px-6 text-base bg-transparent text-background border-background/30 hover:bg-background/10 hover:text-background"
                  >
                    Talk to us
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
