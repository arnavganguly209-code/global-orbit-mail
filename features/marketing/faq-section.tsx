"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/features/marketing/section-heading";
import { faqs } from "@/constants/marketing";

export function FaqSection() {
  return (
    <section id="documentation" className="section-padding relative">
      <Container size="md">
        <SectionHeading
          eyebrow="FAQ"
          title="Answers for enterprise buyers"
          description="Clear guidance before you migrate domains and mailboxes."
        />
        <div id="faq" className="glass-surface mt-12 rounded-3xl px-5 sm:px-8">
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((item, index) => (
              <AccordionItem key={item.q} value={`item-${index}`}>
                <AccordionTrigger className="text-left text-base">{item.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </Container>
    </section>
  );
}
