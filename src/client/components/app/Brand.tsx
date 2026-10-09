import { useBranding } from "../../lib/branding";

// Header/sign-in branding from settings. Lines with no value are left out.
export function Brand() {
  const { shortName, teamName, appName } = useBranding();
  const title = teamName ?? appName ?? "Checklist";
  const subtitle = teamName ? appName : null;

  return (
    <div className="flex min-w-0 items-center gap-3">
      {shortName && (
        <span
          aria-hidden="true"
          className="grid h-8 min-w-8 shrink-0 place-items-center rounded-control bg-accent px-1.5 text-[11px] font-bold tracking-wide text-white"
        >
          {shortName}
        </span>
      )}
      <p className="min-w-0 leading-tight">
        <span className="block truncate text-sm font-semibold">{title}</span>
        {subtitle && <span className="block truncate text-meta text-fg-muted">{subtitle}</span>}
      </p>
    </div>
  );
}
