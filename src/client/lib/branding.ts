import { createContext, useContext } from "react";
import type { BrandingResponse } from "../../shared/types";

// Church branding comes from admin-editable settings (GET /api/branding), never from code.
// When nothing is set (or it failed to load) the UI falls back to the neutral word "Checklist".

export const NO_BRANDING: BrandingResponse = { shortName: null, teamName: null, appName: null };

export const BrandingContext = createContext<BrandingResponse>(NO_BRANDING);

export const useBranding = () => useContext(BrandingContext);

/** Browser tab title, e.g. "Pre-Service Checklist · IFC Production". */
export const documentTitle = (b: BrandingResponse) => [b.appName, b.teamName].filter(Boolean).join(" · ") || "Checklist";
