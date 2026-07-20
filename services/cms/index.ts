/**
 * CMS service stubs — custom enterprise CMS modules.
 */

import { cmsModules } from "@/lib/cms";

export const cmsService = {
  listModules() {
    return cmsModules;
  },
} as const;
