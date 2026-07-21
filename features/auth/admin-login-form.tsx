"use client";

import { useSearchParams } from "next/navigation";
import { OrbitAdminLoginForm } from "@/features/auth/orbit-admin-login-form";

/** Orbit Super Admin login — premium console form (no demo credentials). */
export function AdminLoginForm() {
  useSearchParams(); // keep suspense boundary compatible with prior usage
  return <OrbitAdminLoginForm />;
}
