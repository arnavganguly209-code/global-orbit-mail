/**
 * Marketing content constants — Phase 1 landing only.
 */

export const navItems = [
  { label: "Features", href: "/features" },
  { label: "Pricing", href: "/pricing" },
  { label: "Business Email", href: "/business-email" },
  { label: "Enterprise", href: "/enterprise" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Documentation", href: "/documentation" },
] as const;

export const trustMetrics = [
  { label: "Enterprise Ready", value: 100, suffix: "%", display: "Enterprise Ready" },
  { label: "Uptime SLA", value: 99.99, suffix: "%", display: "99.99% Uptime" },
  { label: "Military Grade Security", value: 1, suffix: "", display: "Military Grade Security" },
  { label: "Spam Protection", value: 1, suffix: "", display: "Spam Protection" },
  { label: "Unlimited Domains", value: 1, suffix: "", display: "Unlimited Domains" },
  { label: "Unlimited Mailboxes", value: 1, suffix: "", display: "Unlimited Mailboxes" },
  { label: "Enterprise Support", value: 1, suffix: "", display: "Enterprise Support" },
  { label: "Modern Infrastructure", value: 1, suffix: "", display: "Modern Infrastructure" },
] as const;

export const features = [
  { title: "Unlimited Mailboxes", description: "Scale identities without artificial caps as your organization grows." },
  { title: "Multiple Domains", description: "Host brands, subsidiaries, and client domains from one control plane." },
  { title: "Professional Webmail", description: "A refined webmail experience designed for daily executive use." },
  { title: "Spam Protection", description: "Multi-layer filtering that keeps inboxes clean without blocking the critical." },
  { title: "SSL Encryption", description: "Encrypted transport everywhere — certificates managed with enterprise care." },
  { title: "DKIM", description: "Cryptographic signing that proves your messages are authentically yours." },
  { title: "SPF", description: "Authoritative sender policy that hardens deliverability and domain trust." },
  { title: "DMARC", description: "Policy enforcement and reporting for complete domain authentication." },
  { title: "Enterprise Security", description: "Defense-in-depth architecture for regulated and high-stakes teams." },
  { title: "White Label", description: "Present a branded mail experience that feels native to your company." },
  { title: "API Ready", description: "Automation-friendly surfaces prepared for provisioning and integrations." },
  { title: "Admin Dashboard", description: "Govern domains, users, and policies from a calm command center." },
  { title: "Global Infrastructure", description: "Modern routing and resilience designed for worldwide teams." },
  { title: "Real Time Monitoring", description: "Operational visibility when every delivery window matters." },
  { title: "Automatic Backups", description: "Continuity built in — recover with confidence, not ceremony." },
  { title: "Mobile Friendly", description: "Responsive webmail crafted for phones, tablets, and desktops." },
  { title: "Dark Mode", description: "A nocturnal interface that stays elegant through long sessions." },
] as const;

export const howItWorks = [
  { step: 1, title: "Register", description: "Create your organization workspace in minutes." },
  { step: 2, title: "Add Domain", description: "Connect your custom business domain." },
  { step: 3, title: "Configure DNS", description: "Apply SPF, DKIM, DMARC, and MX with guided clarity." },
  { step: 4, title: "Create Mailboxes", description: "Provision professional addresses for every teammate." },
  { step: 5, title: "Login", description: "Access polished webmail from any modern device." },
  { step: 6, title: "Start Sending Mail", description: "Communicate with deliverability and brand authority." },
] as const;

export const pricingPlans = [
  {
    id: "starter",
    name: "Business Starter",
    price: "$2",
    period: "/month",
    billingNote: "Only $0.75/month when billed for 12 or 24 months",
    description: "Professional email for solo founders and small teams.",
    featured: false,
    cta: "Get Started",
    href: "/signup?plan=starter",
    features: [
      "1 GB Storage",
      "1 Mailbox",
      "Custom Domain",
      "Spam Protection",
      "SSL",
      "Professional Email",
    ],
  },
  {
    id: "business",
    name: "Business Pro",
    price: "$7",
    period: "/month",
    description: "Scale mailboxes, branding, and authentication for growing teams.",
    featured: true,
    badge: "Most Popular",
    cta: "Get Started",
    href: "/signup?plan=business",
    features: [
      "10 GB Storage",
      "10 Mailboxes",
      "White Label",
      "Priority Support",
      "Spam Protection",
      "DKIM · SPF · DMARC",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Contact Sales",
    period: "",
    description: "Unlimited scale with dedicated infrastructure and 24/7 support.",
    featured: false,
    cta: "Contact Sales",
    href: "/contact?intent=enterprise",
    features: [
      "Unlimited Domains",
      "Unlimited Mailboxes",
      "Dedicated Infrastructure",
      "Dedicated IP",
      "Priority Infrastructure",
      "24/7 Support",
    ],
  },
] as const;

export const comparisons = [
  {
    capability: "White-label experience",
    orbit: true,
    google: false,
    zoho: "Limited",
    titan: "Limited",
    microsoft: false,
  },
  {
    capability: "Unlimited domains (Enterprise)",
    orbit: true,
    google: false,
    zoho: false,
    titan: false,
    microsoft: false,
  },
  {
    capability: "Unlimited mailboxes (Enterprise)",
    orbit: true,
    google: false,
    zoho: false,
    titan: false,
    microsoft: false,
  },
  {
    capability: "Full DNS control (SPF/DKIM/DMARC)",
    orbit: true,
    google: "Partial",
    zoho: true,
    titan: true,
    microsoft: "Partial",
  },
  {
    capability: "Dedicated IP options",
    orbit: true,
    google: false,
    zoho: "Enterprise",
    titan: false,
    microsoft: false,
  },
  {
    capability: "Premium design-first webmail",
    orbit: true,
    google: true,
    zoho: false,
    titan: false,
    microsoft: true,
  },
  {
    capability: "Agency-ready multi-tenant model",
    orbit: true,
    google: false,
    zoho: "Limited",
    titan: false,
    microsoft: false,
  },
  {
    capability: "Transparent enterprise pricing",
    orbit: true,
    google: false,
    zoho: true,
    titan: true,
    microsoft: false,
  },
] as const;

export const testimonials = [
  {
    quote:
      "GLOBAL ORBIT MAIL feels like private infrastructure with consumer-grade polish. Our leadership finally stopped asking for another Workspace seat.",
    name: "Anika Sharma",
    role: "Chief Technology Officer",
    company: "Northbridge Capital",
  },
  {
    quote:
      "We white-labeled the entire experience for client brands. Deliverability improved, and the admin surface is calmer than anything we used before.",
    name: "Marcus Reid",
    role: "Founder",
    company: "Agency Ledger",
  },
  {
    quote:
      "Security reviews passed faster because SPF, DKIM, and DMARC were first-class — not buried behind opaque settings.",
    name: "Elena Voss",
    role: "Head of IT",
    company: "Helix Manufacturing",
  },
  {
    quote:
      "The product looks expensive because it is intentional. Our board noticed the difference on day one.",
    name: "Julian Park",
    role: "Managing Partner",
    company: "Orbit Ventures APAC",
  },
] as const;

export const faqs = [
  {
    q: "What is GLOBAL ORBIT MAIL?",
    a: "A premium white-label enterprise email hosting platform for startups, agencies, and large organizations that need branded, secure, scalable business mail.",
  },
  {
    q: "Who is this platform designed for?",
    a: "Modern businesses that want professional email on their own domains — from early-stage teams to multi-brand enterprises and managed service providers.",
  },
  {
    q: "Can I use my own domain?",
    a: "Yes. You connect your domain, configure DNS, and host mailboxes under your brand with full authentication controls.",
  },
  {
    q: "Do you support unlimited domains on Enterprise?",
    a: "Yes. Enterprise plans are designed for unlimited domains and unlimited mailboxes with dedicated resources.",
  },
  {
    q: "Is white-label available?",
    a: "White-label capabilities are included on Professional and expanded on Enterprise so the experience can match your brand.",
  },
  {
    q: "How does security compare to consumer mail?",
    a: "GLOBAL ORBIT MAIL is built around enterprise security practices including SSL, spam protection, and full SPF/DKIM/DMARC support.",
  },
  {
    q: "Do you provide SPF, DKIM, and DMARC?",
    a: "Yes. Domain authentication is a core platform capability, not an afterthought.",
  },
  {
    q: "Is there an admin dashboard?",
    a: "Yes. Administrators manage domains, mailboxes, and policies from a dedicated enterprise console.",
  },
  {
    q: "Can agencies manage multiple client organizations?",
    a: "The architecture is multi-tenant and agency-ready, designed for organizations that operate many brands or clients.",
  },
  {
    q: "What uptime should we expect?",
    a: "The platform targets a 99.99% uptime posture with modern infrastructure and continuous monitoring.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes. You can start a free trial from the user portal and evaluate the experience with your own domain.",
  },
  {
    q: "Where do I sign in to webmail?",
    a: "User webmail is available at webmail.theglobalorbit.com.",
  },
  {
    q: "Where is the Super Admin portal?",
    a: "Administrative access is available at admin.theglobalorbit.com.",
  },
  {
    q: "Do you offer API access?",
    a: "Professional and Enterprise tiers include API-ready surfaces for provisioning and automation workflows.",
  },
  {
    q: "Can we get a dedicated IP?",
    a: "Dedicated IP options are available on Enterprise for organizations with advanced deliverability requirements.",
  },
  {
    q: "Is mobile access supported?",
    a: "Yes. Webmail is fully responsive and designed for phones, tablets, and desktops.",
  },
  {
    q: "Do you support dark mode?",
    a: "Yes. The interface includes a refined dark mode for long working sessions.",
  },
  {
    q: "How do backups work?",
    a: "Automatic backups are part of the platform continuity model to support recovery with confidence.",
  },
  {
    q: "What support options exist?",
    a: "Starter includes professional support, Professional includes priority support, and Enterprise includes 24/7 coverage.",
  },
  {
    q: "Can GLOBAL ORBIT MAIL replace Google Workspace or Microsoft 365 for email?",
    a: "For organizations that want branded, controllable, white-label business email hosting, GLOBAL ORBIT MAIL is purpose-built as a premium alternative focused on mail excellence.",
  },
  {
    q: "Is this open-source Roundcube hosting?",
    a: "No. GLOBAL ORBIT MAIL is a commercial enterprise product with its own design system, portals, and platform architecture.",
  },
] as const;
