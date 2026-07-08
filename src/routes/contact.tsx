import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { z } from "zod";
import { toast } from "sonner";
import {
  Mail,
  Briefcase,
  Clock,
  MapPin,
  MessagesSquare,
  Twitter,
  Instagram,
  Linkedin,
  Youtube,
  Send,
} from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Us — Connecx" },
      {
        name: "description",
        content:
          "Get in touch with the Connecx team. We reply to every message within 24–48 hours.",
      },
      { property: "og:title", content: "Contact Us — Connecx" },
      {
        property: "og:description",
        content: "Contact Connecx support or business team. Response within 24–48 hours.",
      },
    ],
    links: [{ rel: "canonical", href: "/contact" }],
  }),
  component: ContactPage,
});

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  subject: z.string().trim().min(3, "Subject is required").max(150),
  message: z.string().trim().min(10, "Message is too short").max(2000),
});

function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = contactSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check your entries");
      return;
    }
    setSubmitting(true);
    const body = encodeURIComponent(
      `Name: ${parsed.data.name}\nEmail: ${parsed.data.email}\n\n${parsed.data.message}`,
    );
    const subject = encodeURIComponent(parsed.data.subject);
    window.location.href = `mailto:support@connecx.in?subject=${subject}&body=${body}`;
    setTimeout(() => {
      setSubmitting(false);
      toast.success("Opening your email client…");
    }, 600);
  };

  return (
    <PublicLayout>
      <section className="relative overflow-hidden border-b border-border/60">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 grid-bg opacity-60" />
        </div>
        <div className="max-w-4xl mx-auto px-6 pt-16 pb-14 md:pt-24 md:pb-16 text-center">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Contact
            </p>
            <h1 className="mt-3 font-display text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
              We'd love to hear from you.
            </h1>
            <p className="mt-5 text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Questions, partnerships, or feedback — send us a note and we'll get back within
              24–48 hours.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16 md:py-20 grid gap-8 lg:grid-cols-5">
        {/* Info cards */}
        <div className="lg:col-span-2 space-y-4">
          {[
            {
              icon: Mail,
              title: "Support email",
              value: "connecxofficial@gmail.com",
              href: "mailto:connecxofficial@gmail.com",
            },
            {
              icon: Briefcase,
              title: "Business inquiries",
              value: "connecxofficial@gmail.com",
              href: "mailto:connecxofficial@gmail.com",
            },
            {
              icon: Clock,
              title: "Response time",
              value: "Within 24–48 hours",
            },
          ].map((c) => (
            <motion.a
              key={c.title}
              href={c.href}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="block surface-card p-5 hover:shadow-elevated hover:-translate-y-0.5 transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
                  <c.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {c.title}
                  </p>
                  <p className="mt-1 font-medium text-foreground truncate">{c.value}</p>
                </div>
              </div>
            </motion.a>
          ))}

          <div className="surface-card p-5">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
                <MessagesSquare className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Common questions
                </p>
                <Link to="/faq" className="mt-0.5 inline-block font-medium text-foreground hover:text-accent transition-colors">
                  Visit our FAQ →
                </Link>
              </div>
            </div>
          </div>

          <div className="surface-card p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Follow us
            </p>
            <div className="mt-3 flex items-center gap-2">
              {[
                { icon: Instagram, href: "https://instagram.com", label: "Instagram" },
                { icon: Linkedin, href: "https://linkedin.com", label: "LinkedIn" },
              ].map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="h-9 w-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
                >
                  <s.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Form */}
        <motion.form
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          onSubmit={onSubmit}
          className="lg:col-span-3 surface-card p-6 md:p-8 space-y-5"
        >
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight">Send a message</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Fill in the form and we'll respond to your email within 24–48 hours.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Your full name"
                maxLength={100}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="you@example.com"
                maxLength={255}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              placeholder="What is this about?"
              maxLength={150}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              placeholder="Tell us a bit more…"
              rows={6}
              maxLength={2000}
              required
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              By sending you agree to our{" "}
              <Link to="/privacy" className="underline underline-offset-4 hover:text-foreground">
                privacy policy
              </Link>
              .
            </p>
            <Button type="submit" className="gap-2" disabled={submitting}>
              <Send className="h-4 w-4" />
              {submitting ? "Sending…" : "Send message"}
            </Button>
          </div>
        </motion.form>
      </section>
    </PublicLayout>
  );
}
