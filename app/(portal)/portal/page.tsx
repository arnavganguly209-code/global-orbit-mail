import { redirect } from "next/navigation";
import { external } from "@/config/routes";

/**
 * Portal surface — send users to the webmail host inbox.
 */
export default function PortalRootPage() {
  redirect(external.webmail);
}
