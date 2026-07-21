"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { signupSchema, type SignupInput } from "@/lib/validations/auth";
import { routes } from "@/config/routes";
import { SIGNUP_DRAFT_KEY, type SignupDraft } from "@/lib/billing/pricing";

const COUNTRIES = [
  "Nepal",
  "India",
  "United States",
  "United Kingdom",
  "United Arab Emirates",
  "Singapore",
  "Australia",
  "Canada",
  "Germany",
  "Other",
] as const;

const BUSINESS_TYPES = [
  "Startup",
  "SME",
  "Agency",
  "Enterprise",
  "Non-profit",
  "Education",
  "Other",
] as const;

export function CustomerSignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planFromUrl = searchParams.get("plan") ?? undefined;

  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      company: "",
      country: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      businessName: "",
      businessType: "",
      planKey:
        planFromUrl === "starter" || planFromUrl === "business" || planFromUrl === "enterprise"
          ? planFromUrl
          : undefined,
    },
  });

  function onSubmit(values: SignupInput) {
    // Payment gateway offline: never create an account from self-serve signup.
    const draft: SignupDraft = {
      name: values.name,
      company: values.company,
      country: values.country,
      email: values.email.toLowerCase().trim(),
      phone: values.phone,
      password: values.password,
      businessName: values.businessName,
      businessType: values.businessType,
      planKey: values.planKey,
    };
    try {
      sessionStorage.setItem(SIGNUP_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      toast.error("Unable to save signup progress in this browser");
      return;
    }
    router.push("/signup/plan");
  }

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate autoComplete="off">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="signup-name">Full name</Label>
          <Input id="signup-name" placeholder="Jordan Blake" {...form.register("name")} />
          {form.formState.errors.name ? (
            <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="signup-company">Company</Label>
          <Input id="signup-company" placeholder="Northbridge Capital" {...form.register("company")} />
          {form.formState.errors.company ? (
            <p className="text-xs text-destructive">{form.formState.errors.company.message}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Country</Label>
          <Select
            value={form.watch("country")}
            onValueChange={(v) => form.setValue("country", v, { shouldValidate: true })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.formState.errors.country ? (
            <p className="text-xs text-destructive">{form.formState.errors.country.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="signup-phone">Phone</Label>
          <Input id="signup-phone" placeholder="+977 98XXXXXXXX" {...form.register("phone")} />
          {form.formState.errors.phone ? (
            <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-email">Work email</Label>
        <Input
          id="signup-email"
          type="email"
          placeholder="you@company.com"
          {...form.register("email")}
        />
        {form.formState.errors.email ? (
          <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="signup-business">Business name</Label>
          <Input id="signup-business" placeholder="Legal / trading name" {...form.register("businessName")} />
          {form.formState.errors.businessName ? (
            <p className="text-xs text-destructive">{form.formState.errors.businessName.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label>Business type</Label>
          <Select
            value={form.watch("businessType")}
            onValueChange={(v) => form.setValue("businessType", v, { shouldValidate: true })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {BUSINESS_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.formState.errors.businessType ? (
            <p className="text-xs text-destructive">{form.formState.errors.businessType.message}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="signup-password">Password</Label>
          <Input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 12 characters"
            {...form.register("password")}
          />
          {form.formState.errors.password ? (
            <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="signup-confirm">Confirm password</Label>
          <Input
            id="signup-confirm"
            type="password"
            autoComplete="new-password"
            placeholder="Repeat password"
            {...form.register("confirmPassword")}
          />
          {form.formState.errors.confirmPassword ? (
            <p className="text-xs text-destructive">{form.formState.errors.confirmPassword.message}</p>
          ) : null}
        </div>
      </div>

      <Button type="submit" className="w-full gradient-blue border-0" size="lg">
        Continue to plans
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already activated by our team?{" "}
        <Link href={routes.signin} className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
      <p className="text-center text-[11px] text-muted-foreground">
        Online payments are temporarily offline. Completing this form does not create an account until
        Global Orbit activates your subscription.
      </p>
    </form>
  );
}
