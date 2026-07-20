"use client";

import { motion } from "framer-motion";
import { Check, Minus, X } from "lucide-react";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/features/marketing/section-heading";
import { comparisons } from "@/constants/marketing";

function Cell({ value }: { value: boolean | string }) {
  if (value === true) {
    return <Check className="mx-auto size-4 text-gold" aria-label="Yes" />;
  }
  if (value === false) {
    return <X className="mx-auto size-4 text-muted-foreground/50" aria-label="No" />;
  }
  return <span className="text-xs text-muted-foreground">{value}</span>;
}

export function ComparisonSection() {
  return (
    <section id="why" className="section-padding relative">
      <Container>
        <SectionHeading
          eyebrow="Why GLOBAL ORBIT"
          title="A clearer alternative to the default inbox giants"
          description="Compare capability density against Google Workspace, Zoho Mail, Titan Mail, and Microsoft 365."
        />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass-surface mt-14 overflow-x-auto rounded-3xl"
        >
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border/70">
                <th className="px-5 py-4 text-left font-medium text-muted-foreground">
                  Capability
                </th>
                <th className="px-3 py-4 text-center font-semibold text-gold">Orbit</th>
                <th className="px-3 py-4 text-center font-medium text-muted-foreground">
                  Google
                </th>
                <th className="px-3 py-4 text-center font-medium text-muted-foreground">
                  Zoho
                </th>
                <th className="px-3 py-4 text-center font-medium text-muted-foreground">
                  Titan
                </th>
                <th className="px-3 py-4 text-center font-medium text-muted-foreground">
                  Microsoft
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisons.map((row) => (
                <tr key={row.capability} className="border-b border-border/40 last:border-0">
                  <td className="px-5 py-4 text-left">{row.capability}</td>
                  <td className="px-3 py-4 text-center">
                    <Cell value={row.orbit} />
                  </td>
                  <td className="px-3 py-4 text-center">
                    <Cell value={row.google} />
                  </td>
                  <td className="px-3 py-4 text-center">
                    <Cell value={row.zoho} />
                  </td>
                  <td className="px-3 py-4 text-center">
                    <Cell value={row.titan} />
                  </td>
                  <td className="px-3 py-4 text-center">
                    <Cell value={row.microsoft} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center gap-4 border-t border-border/50 px-5 py-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Check className="size-3 text-gold" /> Included
            </span>
            <span className="inline-flex items-center gap-1">
              <Minus className="size-3" /> Limited / Partial noted in-cell
            </span>
          </div>
        </motion.div>
      </Container>
    </section>
  );
}
