import type { ReactNode } from "react";
import { motion } from "framer-motion";

export function LegalPage({
  eyebrow,
  title,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <section className="max-w-3xl mx-auto px-6 py-16 md:py-24">
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          {eyebrow}
        </p>
        <h1 className="mt-3 font-display text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
          {title}
        </h1>
        {updated ? (
          <p className="mt-4 text-sm text-muted-foreground">Last updated: {updated}</p>
        ) : null}
      </motion.header>

      <motion.article
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.05 }}
        className="mt-10 space-y-8 text-[15px] leading-relaxed text-muted-foreground [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:tracking-tight [&_h2]:mb-3 [&_h3]:font-display [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mb-2 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1.5 [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-accent"
      >
        {children}
      </motion.article>
    </section>
  );
}
