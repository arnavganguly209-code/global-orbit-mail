"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  MarketingPage,
  MarketingPageHero,
} from "@/features/marketing/marketing-page";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ContactPage() {
  const [pending, setPending] = React.useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    window.setTimeout(() => {
      setPending(false);
      toast.success("Message received — our team will reply shortly.");
      (e.target as HTMLFormElement).reset();
    }, 600);
  }

  return (
    <MarketingPage>
      <MarketingPageHero
        eyebrow="Contact"
        title="Talk with GLOBAL ORBIT."
        description="Sales, enterprise architecture, or onboarding — send a note and we will respond."
      />
      <Container className="pb-24">
        <form
          onSubmit={onSubmit}
          className="glass-surface mx-auto grid max-w-xl gap-4 rounded-3xl p-8"
        >
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <textarea
              id="message"
              name="message"
              required
              rows={5}
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm"
            />
          </div>
          <Button type="submit" className="gradient-blue border-0" disabled={pending}>
            {pending ? "Sending…" : "Send message"}
          </Button>
        </form>
      </Container>
    </MarketingPage>
  );
}
