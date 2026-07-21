import { redirect } from "next/navigation";
import { routes } from "@/config/routes";

/**
 * Legacy path — customer sign-in now lives at /signin.
 */
export default function LegacyLoginPage() {
  redirect(routes.signin);
}
