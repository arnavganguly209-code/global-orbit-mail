/** Persist To/Cc/Bcc addresses per mailbox for compose autocomplete. */

const PREFIX = "orbit-wm-recipients:";
const MAX = 80;

function storageKey(mailboxEmail: string) {
  return `${PREFIX}${mailboxEmail.trim().toLowerCase()}`;
}

function normalizeAddress(raw: string) {
  const trimmed = raw.trim().toLowerCase();
  const angle = trimmed.match(/<([^>]+)>/);
  const email = (angle?.[1] || trimmed).replace(/^mailto:/i, "").trim();
  if (!email.includes("@") || email.length < 3) return null;
  return email;
}

export function loadRememberedRecipients(mailboxEmail: string): string[] {
  if (typeof window === "undefined" || !mailboxEmail) return [];
  try {
    const raw = window.localStorage.getItem(storageKey(mailboxEmail));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((v) => (typeof v === "string" ? normalizeAddress(v) : null))
      .filter((v): v is string => Boolean(v))
      .slice(0, MAX);
  } catch {
    return [];
  }
}

export function rememberRecipients(mailboxEmail: string, addresses: string[]) {
  if (typeof window === "undefined" || !mailboxEmail) return;
  const next = new Set(loadRememberedRecipients(mailboxEmail));
  for (const part of addresses) {
    for (const token of part.split(/[,;]+/)) {
      const email = normalizeAddress(token);
      if (email && email !== mailboxEmail.trim().toLowerCase()) next.add(email);
    }
  }
  const list = [...next].slice(0, MAX);
  try {
    window.localStorage.setItem(storageKey(mailboxEmail), JSON.stringify(list));
  } catch {
    /* quota / private mode */
  }
}

export function mergeRecipientLists(...lists: Array<string[] | undefined>) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const item of list || []) {
      const email = normalizeAddress(item);
      if (!email || seen.has(email)) continue;
      seen.add(email);
      out.push(email);
    }
  }
  return out;
}
