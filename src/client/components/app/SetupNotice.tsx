import type { Navigate } from "../../lib/router";
import { AlertIcon } from "../ui/Icons";
import { RouteLink } from "./RouteLink";

// For Admins and Directors while team mapping isn't set up (US-02, requirements v1.19): they get in, but every
// volunteer sees "The app is being set up", so the people who can fix it are told. Admins get a link to fix it.
export function SetupNotice({ isAdmin, onNavigate }: { isAdmin: boolean; onNavigate: Navigate }) {
  return (
    <div className="mx-auto max-w-app px-4 pt-4 md:px-6 md:pt-6">
      <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-card border border-warning/40 bg-warning/10 py-1.5 pr-1.5 pl-4 text-sm">
        <p className="flex min-w-0 flex-1 basis-56 gap-3 py-1.5">
          <AlertIcon className="mt-0.5 size-4 shrink-0 text-warning" />
          <span>
            Volunteers can't get in yet: team mapping isn't set up.
            {!isAdmin && " An Admin can set it up under Admin › Team mapping."}
          </span>
        </p>
        {isAdmin && (
          <RouteLink
            to="admin-mapping"
            current={false}
            onNavigate={onNavigate}
            className="inline-flex min-h-11 items-center rounded-control px-3 font-medium text-accent-soft transition-colors hover:bg-hover"
          >
            Set up team mapping
          </RouteLink>
        )}
      </div>
    </div>
  );
}
