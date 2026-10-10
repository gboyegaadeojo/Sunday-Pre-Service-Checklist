import { useBranding } from "../../lib/branding";
import type { Navigate } from "../../lib/router";
import { RouteLink } from "./RouteLink";

// Header/sign-in branding from settings. Lines with no value are left out.
// compact: below the sm breakpoint show only the mark, to leave room for navigation. With no mark (an admin
// can clear it, US-11a) nothing shows there; the names still show from sm up and in the tab title.
// onHome: the header for someone with access, where the branding links to the Checklist, the app's home page
// ("IFC Media Production, go to checklist"). Left out on the sign-in and access screens, where it's plain branding.
export function Brand({ compact = false, onHome }: { compact?: boolean; onHome?: Navigate }) {
  const { shortName, teamName, appName } = useBranding();
  const title = teamName ?? appName ?? "Checklist";
  const subtitle = teamName ? appName : null;
  const layout = `min-w-0 items-center gap-3 ${compact && !shortName ? "hidden sm:flex" : "flex"}`;

  const content = (
    <>
      {shortName && (
        <span
          aria-hidden="true"
          className="grid h-8 min-w-8 shrink-0 place-items-center rounded-control bg-accent px-1.5 text-xs font-bold tracking-wide text-white"
        >
          {shortName}
        </span>
      )}
      <span className={`min-w-0 leading-tight ${compact ? "hidden sm:block" : "block"}`}>
        <span className="block truncate text-sm font-semibold">{title}</span>
        {subtitle && <span className="block truncate text-meta text-fg-muted">{subtitle}</span>}
      </span>
    </>
  );

  if (!onHome) return <div className={layout}>{content}</div>;
  const name = teamName ?? appName;
  return (
    <RouteLink
      to="checklist"
      current={false}
      onNavigate={onHome}
      aria-label={name ? `${name}, go to checklist` : "Go to checklist"}
      className={`${layout} -mx-1.5 min-h-11 rounded-control px-1.5`}
    >
      {content}
    </RouteLink>
  );
}
