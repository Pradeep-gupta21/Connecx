import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — Ventro" },
      {
        name: "description",
        content:
          "Frequently asked questions about Ventro — how the platform works, payments, verification, and support.",
      },
      { property: "og:title", content: "FAQ — Ventro" },
      { property: "og:description", content: "Answers to common questions about using Ventro." },
    ],
    links: [{ rel: "canonical", href: "/faq" }],
  }),
  component: FaqPage,
});

const groups: { title: string; items: { q: string; a: string }[] }[] = [
  {
    title: "Getting started",
    items: [
      {
        q: "What is Ventro?",
        a: "Ventro is a marketplace that connects brands and creators for paid campaigns — with escrow payments, verified profiles, and in-platform messaging.",
      },
      {
        q: "Is Ventro free to sign up?",
        a: "Yes. Creating an account is free for both creators and brands. We charge a small platform fee only when a campaign is successfully funded and delivered.",
      },
      {
        q: "Who can join?",
        a: "Any creator or brand aged 18 or over. Creators go through a lightweight verification review to keep the marketplace authentic.",
      },
    ],
  },
  {
    title: "Payments & payouts",
    items: [
      {
        q: "How do payments work?",
        a: "Brands fund a campaign upfront through Razorpay. Funds are held in escrow and released to the creator only after the brand approves the deliverables.",
      },
      {
        q: "When do creators get paid?",
        a: "Once deliverables are approved, funds are credited to the creator's wallet. Withdrawals to your verified default payout account are processed by the admin team.",
      },
      {
        q: "What are the fees?",
        a: "Ventro charges a transparent platform fee shown at funding time. Payment gateway charges and applicable taxes (GST, TDS) may also apply.",
      },
    ],
  },
  {
    title: "Trust & safety",
    items: [
      {
        q: "How does verification work?",
        a: "Creators submit basic identity and portfolio details. Our team reviews and marks profiles as approved, pending, or rejected. Brands are similarly reviewed.",
      },
      {
        q: "What if a campaign goes wrong?",
        a: "You can raise a dispute from your dashboard. Our support team reviews both sides and issues a fair decision within 7 business days.",
      },
      {
        q: "Is my data safe?",
        a: "Yes. We use encryption in transit and at rest, store payout details with hashing and masking, and never sell your personal information. Read our Privacy Policy for details.",
      },
    ],
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="surface-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 text-left p-5 hover:bg-secondary/40 transition-colors"
      >
        <span className="font-medium text-foreground">{q}</span>
        <span className="h-7 w-7 rounded-md border border-border flex items-center justify-center shrink-0 text-muted-foreground">
          {open ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="px-5 pb-5 pt-0 text-sm text-muted-foreground leading-relaxed">{a}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function FaqPage() {
  return (
    <PublicLayout>
      <section className="relative overflow-hidden border-b border-border/60">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 grid-bg opacity-60" />
        <div className="max-w-4xl mx-auto px-6 pt-16 pb-14 md:pt-24 md:pb-16 text-center">
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Help center</p>
          <h1 className="mt-3 font-display text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
            Frequently asked questions
          </h1>
          <p className="mt-5 text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Everything you need to know about using Ventro. Can't find your answer?{" "}
            <Link to="/contact" className="underline underline-offset-4 hover:text-foreground">
              Contact support
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-16 md:py-20 space-y-12">
        {groups.map((g) => (
          <div key={g.title}>
            <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
              {g.title}
            </h2>
            <div className="mt-5 space-y-3">
              {g.items.map((it) => (
                <FaqItem key={it.q} {...it} />
              ))}
            </div>
          </div>
        ))}
      </section>
    </PublicLayout>
  );
}
