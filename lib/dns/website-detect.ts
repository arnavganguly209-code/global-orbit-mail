/**
 * Detect existing website / foreign mail DNS so onboarding never suggests replacing them.
 * Mail-only records only — never emit www or apex website A/CNAME replacements.
 */
import { promises as dns } from "node:dns";

export type WebsiteDnsPresence = {
  /** Orbit generators never touch www/root website hosts */
  websiteSafe: true;
  apexHasWebsite: boolean;
  wwwHasWebsite: boolean;
  /** Apex or www has A/AAAA/CNAME suitable for a site */
  hasWebsite: boolean;
  /** MX exists but does not point at our mail host */
  existingForeignMx: boolean;
  foreignMxTargets: string[];
  /** www is a CNAME (common Cloudflare / CDN pattern) */
  wwwIsCname: boolean;
  notes: string[];
};

async function hasAOrAaaa(host: string): Promise<boolean> {
  try {
    const a = await dns.resolve4(host);
    if (a.length > 0) return true;
  } catch {
    /* empty */
  }
  try {
    const aaaa = await dns.resolve6(host);
    if (aaaa.length > 0) return true;
  } catch {
    /* empty */
  }
  return false;
}

async function hasCname(host: string): Promise<boolean> {
  try {
    const rows = await dns.resolveCname(host);
    return rows.length > 0;
  } catch {
    return false;
  }
}

export async function detectWebsiteDns(
  apex: string,
  ourMailHost: string,
): Promise<WebsiteDnsPresence> {
  const notes: string[] = [];
  const mailHost = ourMailHost.replace(/\.$/, "").toLowerCase();

  const [apexA, wwwA, wwwCname, apexCname] = await Promise.all([
    hasAOrAaaa(apex),
    hasAOrAaaa(`www.${apex}`),
    hasCname(`www.${apex}`),
    hasCname(apex),
  ]);

  const apexHasWebsite = apexA || apexCname;
  const wwwHasWebsite = wwwA || wwwCname;
  const hasWebsite = apexHasWebsite || wwwHasWebsite;

  if (hasWebsite) {
    notes.push(
      "Website DNS detected on @ and/or www. Global Orbit Mail will only ask for mail records — your site stays unchanged.",
    );
  } else {
    notes.push("No website DNS detected on @/www. Mail records only will still be suggested.");
  }

  let existingForeignMx = false;
  const foreignMxTargets: string[] = [];
  try {
    const mx = await dns.resolveMx(apex);
    for (const row of mx) {
      const exchange = row.exchange.replace(/\.$/, "").toLowerCase();
      if (exchange !== mailHost) {
        existingForeignMx = true;
        foreignMxTargets.push(`${row.priority} ${exchange}`);
      }
    }
    if (existingForeignMx) {
      notes.push(
        "This domain already has MX records pointing elsewhere. Replace them with Global Orbit Mail MX only when you are ready to switch inbound mail.",
      );
    }
  } catch {
    /* no MX yet — fresh domain */
  }

  if (wwwCname) {
    notes.push("www CNAME detected (common with Cloudflare/CDN). Leave it untouched.");
  }

  return {
    websiteSafe: true,
    apexHasWebsite,
    wwwHasWebsite,
    hasWebsite,
    existingForeignMx,
    foreignMxTargets,
    wwwIsCname: wwwCname,
    notes,
  };
}
