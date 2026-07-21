"use client";

import { useSearchParams } from "next/navigation";
import { LoginFormShell } from "@/features/auth/login-form-shell";

export function AdminLoginForm() {
  const searchParams = useSearchParams();
  return <LoginFormShell surface="admin" nextPath={searchParams.get("next") ?? "/admin"} />;
}
