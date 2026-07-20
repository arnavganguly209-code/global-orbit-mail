import { redirect } from "next/navigation";
import { routes } from "@/config/routes";

/**
 * Portal surface reserved for authenticated webmail.
 * Inbox and compose arrive in later phases.
 */
export default function PortalRootPage() {
  redirect(routes.login);
}
