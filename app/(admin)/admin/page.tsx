import { redirect } from "next/navigation";
import { routes } from "@/config/routes";

/**
 * Admin console surface reserved for Super Admin CMS.
 * Module UIs arrive in later phases.
 */
export default function AdminRootPage() {
  redirect(routes.adminLogin);
}
