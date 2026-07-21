/**
 * Server-only DKIM key generation (Node crypto).
 * Do NOT import this module from client components.
 */

import { generateKeyPairSync } from "node:crypto";

export type GeneratedDkimKey = {
  selector: string;
  publicKey: string;
  privateKeyPem: string;
  dnsValue: string;
};

/** Generate RSA-2048 DKIM keypair for a domain. */
export function generateDkimKeypair(selector = "orbit"): GeneratedDkimKey {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  const publicKeyBody = publicKey
    .replace(/-----BEGIN PUBLIC KEY-----/g, "")
    .replace(/-----END PUBLIC KEY-----/g, "")
    .replace(/\s+/g, "");

  return {
    selector,
    publicKey: publicKeyBody,
    privateKeyPem: privateKey,
    dnsValue: `v=DKIM1; k=rsa; p=${publicKeyBody}`,
  };
}
