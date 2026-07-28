"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowDown,
  ArrowRight,
  Globe2,
  Headphones,
  Mail,
  Send,
  Server,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Container } from "@/components/ui/container";
import { brand } from "@/config/brand";
import { routes } from "@/config/routes";

const heroPills = [
  {
    title: "Enterprise Security",
    detail: "SPF • DKIM • DMARC",
    icon: ShieldCheck,
  },
  {
    title: "99.9% Uptime",
    detail: "Reliable. Always.",
    icon: Mail,
  },
  {
    title: "Global Infrastructure",
    detail: "Fast • Secure • Stable",
    icon: Server,
  },
  {
    title: "24/7 Expert Support",
    detail: "We're Always Here",
    icon: Headphones,
  },
] as const;

const heroStats = [
  { value: "10K+", label: "Happy Customers", icon: Users },
  { value: "50M+", label: "Emails Delivered", icon: Send },
  { value: "150+", label: "Countries Reached", icon: Globe2 },
  { value: "99.9%", label: "Uptime Guarantee", icon: ShieldCheck },
] as const;

export function HeroSection() {
  return (
    <section className="relative isolate min-h-[min(920px,calc(100dvh-7.5rem))] overflow-hidden bg-[#05070a]">
      {/* Orbit world + product art — full bleed right, no box */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <Image
          src="/brand/hero-orbit-visual.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[70%_45%] opacity-95 sm:object-[65%_42%] lg:object-[58%_40%]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#05070a] via-[#05070a]/88 to-[#05070a]/15 sm:via-[#05070a]/78 sm:to-transparent lg:from-[#05070a] lg:via-[#05070a]/70 lg:to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#05070a] via-transparent to-[#05070a]/40" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_72%_48%,rgba(30,95,161,0.18),transparent_52%)]" />
      </div>

      <Container className="relative z-10 flex min-h-[min(920px,calc(100dvh-7.5rem))] flex-col justify-center pb-10 pt-12 sm:pb-12 sm:pt-14">
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-2xl"
          >
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#d4af37] sm:text-xs">
              {brand.product} • {brand.tagline.toUpperCase()}
            </p>

            <h1 className="font-display text-[2.35rem] font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl md:text-[3.35rem] lg:text-[3.55rem]">
              Enterprise Email Hosting Built For Modern{" "}
              <span className="bg-gradient-to-r from-[#f6e7a8] via-[#e0bc4a] to-[#c9971a] bg-clip-text text-transparent">
                Businesses
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-zinc-300 sm:text-lg">
              Secure, scalable and white-label business email hosting for startups,
              enterprises and agencies.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-3">
              {heroPills.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="min-w-0">
                    <div className="mb-2 flex size-9 items-center justify-center rounded-lg border border-[#d4af37]/35 bg-[#d4af37]/10 backdrop-blur-sm">
                      <Icon className="size-4 text-[#d4af37]" />
                    </div>
                    <p className="text-[13px] font-semibold leading-snug text-[#f0d78c]">
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-snug text-zinc-400">{item.detail}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href={routes.signup}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#f6e7a8] via-[#e0bc4a] to-[#c9971a] px-7 text-base font-bold text-[#1a1200] shadow-[0_10px_28px_rgba(212,175,55,0.32)] transition hover:brightness-105"
              >
                Start Free Trial
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href={routes.sections.pricing}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-[#d4af37]/55 bg-black/20 px-7 text-base font-semibold text-white backdrop-blur-sm transition hover:bg-[#d4af37]/10"
              >
                View Pricing
                <ArrowDown className="size-4 text-[#d4af37]" />
              </Link>
            </div>
          </motion.div>

          {/* Keeps right composition space — art lives in the background, not a card */}
          <div className="pointer-events-none relative hidden min-h-[20rem] lg:block" aria-hidden />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.7 }}
          className="mt-12 rounded-2xl border border-white/10 bg-[#0b0e14]/70 px-4 py-5 backdrop-blur-md sm:mt-14 sm:px-6"
        >
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-0">
            {heroStats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className={index > 0 ? "md:border-l md:border-white/10 md:px-6" : "md:px-2"}
                >
                  <div className="flex items-start gap-3">
                    <Icon className="mt-1 size-4 shrink-0 text-[#d4af37]" />
                    <div>
                      <p className="font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                        {stat.value}
                      </p>
                      <p className="mt-1 text-xs text-zinc-400 sm:text-sm">{stat.label}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </Container>
    </section>
  );
}
