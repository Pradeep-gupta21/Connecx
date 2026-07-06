import { Link } from "@tanstack/react-router";
import { Twitter, Instagram, Linkedin, Youtube, Mail } from "lucide-react";
import { Logo } from "@/components/common/Logo";

const quickLinks = [
  { label: "Home", to: "/" as const },
  { label: "Explore Creators", to: "/#for-brands" as const, hash: true },
  { label: "For Brands", to: "/#for-brands" as const, hash: true },
  { label: "FAQ", to: "/faq" as const },
];

const companyLinks = [
  { label: "About Us", to: "/about" as const },
  { label: "Contact Us", to: "/contact" as const },
];

const legalLinks = [
  { label: "Privacy Policy", to: "/privacy" as const },
  { label: "Terms & Conditions", to: "/terms" as const },
  { label: "Refund & Cancellation", to: "/refund" as const },
];

const socials = [
  { label: "Twitter", href: "https://twitter.com", icon: Twitter },
  { label: "Instagram", href: "https://instagram.com", icon: Instagram },
  { label: "LinkedIn", href: "https://linkedin.com", icon: Linkedin },
  { label: "YouTube", href: "https://youtube.com", icon: Youtube },
];

function FooterLink({ to, label, hash }: { to: string; label: string; hash?: boolean }) {
  if (hash) {
    return (
      <a
        href={to}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {label}
      </a>
    );
  }
  return (
    <Link
      to={to}
      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      {label}
    </Link>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-surface/40">
      <div className="max-w-6xl mx-auto px-6 py-14 md:py-16">
        <div className="grid gap-10 md:gap-12 md:grid-cols-12">
          {/* Brand */}
          <div className="md:col-span-4">
            <Logo />
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-xs">
              Ventro is where ambitious brands meet authentic creators — with transparent
              collaboration and secure payments.
            </p>
            <a
              href="mailto:support@ventro.in"
              className="mt-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Mail className="h-3.5 w-3.5" />
              support@ventro.in
            </a>
          </div>

          {/* Quick Links */}
          <div className="md:col-span-2">
            <h3 className="font-display text-xs font-semibold uppercase tracking-widest text-foreground">
              Quick Links
            </h3>
            <ul className="mt-4 space-y-2.5">
              {quickLinks.map((l) => (
                <li key={l.label}>
                  <FooterLink {...l} />
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div className="md:col-span-2">
            <h3 className="font-display text-xs font-semibold uppercase tracking-widest text-foreground">
              Company
            </h3>
            <ul className="mt-4 space-y-2.5">
              {companyLinks.map((l) => (
                <li key={l.label}>
                  <FooterLink {...l} />
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div className="md:col-span-4">
            <h3 className="font-display text-xs font-semibold uppercase tracking-widest text-foreground">
              Legal
            </h3>
            <ul className="mt-4 space-y-2.5">
              {legalLinks.map((l) => (
                <li key={l.label}>
                  <FooterLink {...l} />
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-border/60 flex flex-col-reverse md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            © 2026 Ventro. All Rights Reserved.
          </p>
          <div className="flex items-center gap-1">
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
              >
                <s.icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
