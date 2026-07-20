"use client";

import { motion } from "framer-motion";
import { Shield, Server, Lock, Mail, Globe2, Inbox, Headphones, Cpu } from "lucide-react";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/features/marketing/section-heading";

const items = [
  { icon: Shield, title: "Enterprise Ready" },
  { icon: Server, title: "99.99% Uptime" },
  { icon: Lock, title: "Military Grade Security" },
  { icon: Mail, title: "Spam Protection" },
  { icon: Globe2, title: "Unlimited Domains" },
  { icon: Inbox, title: "Unlimited Mailboxes" },
  { icon: Headphones, title: "Enterprise Support" },
  { icon: Cpu, title: "Modern Infrastructure" },
];

export function TrustSection() {
  return (
    <section id="enterprise" className="section-padding relative">
      <Container>
        <SectionHeading
          eyebrow="Trust"
          title="Built for organizations that cannot afford compromise"
          description="Infrastructure posture and product discipline designed for enterprise confidence."
        />
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: index * 0.04, duration: 0.5 }}
              className="glass-surface group rounded-2xl p-6 transition-transform duration-300 hover:-translate-y-1"
            >
              <item.icon className="mb-4 size-5 text-primary transition-colors group-hover:text-gold" />
              <p className="font-display text-lg font-semibold tracking-tight">{item.title}</p>
              {item.title.includes("99.99") ? (
                <p className="mt-2 font-mono text-3xl font-semibold text-gold">99.99%</p>
              ) : null}
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  );
}
