/**
 * GLOBAL ORBIT MAIL — Design Tokens
 * Source of truth for spacing, radius, motion, and z-index scales.
 */

export const designTokens = {
  radius: {
    none: "0",
    sm: "0.375rem",
    md: "0.5rem",
    lg: "0.75rem",
    xl: "1rem",
    "2xl": "1.25rem",
    full: "9999px",
  },
  spacing: {
    section: "5rem",
    sectionMobile: "3rem",
    container: "1.5rem",
  },
  motion: {
    fast: "150ms",
    base: "250ms",
    slow: "400ms",
    spring: { type: "spring", stiffness: 380, damping: 30 },
    ease: [0.22, 1, 0.36, 1] as const,
  },
  zIndex: {
    base: 0,
    dropdown: 50,
    sticky: 100,
    overlay: 200,
    modal: 300,
    toast: 400,
    tooltip: 500,
  },
} as const;

export type DesignTokens = typeof designTokens;
