/**
 * GSAP helpers — register plugins once on the client.
 */
"use client";

import gsap from "gsap";

let registered = false;

export function getGsap() {
  if (!registered && typeof window !== "undefined") {
    registered = true;
  }
  return gsap;
}

export { gsap };
