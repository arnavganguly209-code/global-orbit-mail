"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { STORAGE_KEYS } from "@/constants";

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      storageKey={STORAGE_KEYS.theme}
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
