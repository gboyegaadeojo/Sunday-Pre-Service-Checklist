import { AdminShortcuts } from "../../components/admin/AdminLayout";
import { RouteLink } from "../../components/app/RouteLink";
import { Card } from "../../components/ui/Card";
import { AlertIcon, CheckIcon } from "../../components/ui/Icons";
import { attentionItems, useMappingStatus } from "../../lib/adminAttention";
import type { Navigate } from "../../lib/router";

// Administrative Settings' landing page (design.md §7, requirements v1.20): first, what needs an Admin's attention,
// only problems an Admin can fix, each with a link to where to fix it; then a shortcut to every section. No progress
// numbers here: Progress has them, one link away.
export function AdminHomePage({ onNavigate }: { onNavigate: Navigate }) {
  // Shared with the header and the sidebar; the layout asks again whenever the section changes.
  const status = useMappingStatus(true);
  const items = attentionItems(status);
  const sidebarCounts = { attention: (status?.unlinked ?? 0) + (status?.missing ?? 0), newTeams: status?.newTeams ?? 0 };

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 pt-4 pb-24 md:px-6 md:pt-6">
      <header>
        <h1 className="text-page font-semibold tracking-tight">Admin home</h1>
        <p className="text-sm text-fg-muted">What needs your attention, and every part of Administrative Settings.</p>
      </header>

      <section aria-labelledby="attention-heading">
        <h2 id="attention-heading" className="mb-2 text-base font-semibold">
          Needs attention
        </h2>
        {status === null ? (
          <p role="status" className="text-sm text-fg-muted">
            Checking…
          </p>
        ) : items.length === 0 ? (
          <Card className="flex items-center gap-3 px-4 py-3.5 md:px-5">
            <CheckIcon className="size-5 shrink-0 text-success" />
            <p className="text-sm">Nothing needs your attention.</p>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-line">
              {items.map((item) => (
                <li key={item.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3.5 md:px-5">
                  <AlertIcon className="mt-0.5 size-4 shrink-0 text-warning" />
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="mt-0.5 text-meta text-fg-muted">{item.detail}</p>
                  </div>
                  <RouteLink
                    to="admin-mapping"
                    current={false}
                    onNavigate={onNavigate}
                    className="-my-1.5 inline-flex min-h-11 items-center rounded-control px-3 text-sm font-medium text-accent-soft transition-colors hover:bg-hover"
                  >
                    Fix in Team mapping
                  </RouteLink>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <section aria-labelledby="shortcuts-heading">
        <h2 id="shortcuts-heading" className="mb-2 text-base font-semibold">
          Shortcuts
        </h2>
        <AdminShortcuts onNavigate={onNavigate} attention={sidebarCounts} />
      </section>

      <RouteLink
        to="progress"
        current={false}
        onNavigate={onNavigate}
        className="inline-flex min-h-11 items-center justify-center rounded-control border border-line bg-card px-4 text-sm font-medium text-fg transition-colors hover:bg-hover"
      >
        See today's progress
      </RouteLink>
    </main>
  );
}
