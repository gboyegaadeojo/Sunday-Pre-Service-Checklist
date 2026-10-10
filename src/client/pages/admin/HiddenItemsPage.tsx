import { useCallback, useState } from "react";
import type { HiddenItem, HiddenParent, StructureKind } from "../../../shared/types";
import { RouteLink } from "../../components/app/RouteLink";
import { SaveIndicator } from "../../components/checklist/SaveIndicator";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { ErrorFeedback, NoticeFeedback } from "../../components/ui/Feedback";
import { PageHeader } from "../../components/ui/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/States";
import { plural } from "../../lib/checklist";
import { formatDateTime } from "../../lib/format";
import type { Navigate } from "../../lib/router";
import { type ListRef, useHiddenItems } from "../../lib/useAdminList";

const KIND_LABEL: Record<StructureKind, string> = { category: "Department", section: "Section", task: "Task" };

type Parent = HiddenParent & { kind: StructureKind };

/** The department and section an item sits in, outermost first. */
function parentsOf(item: HiddenItem): Parent[] {
  const parents: Parent[] = [];
  if (item.category) parents.push({ kind: "category", ...item.category });
  if (item.section) parents.push({ kind: "section", ...item.section });
  return parents;
}

const hiddenParentsOf = (item: HiddenItem) => parentsOf(item).filter((p) => p.hidden);

/** "the section “Sec A” and the department “Audio”", nearest first. */
const describeParents = (parents: Parent[]) =>
  [...parents]
    .reverse()
    .map((p) => `the ${KIND_LABEL[p.kind].toLowerCase()} “${p.name}”`)
    .join(" and ");

const itemKey = (item: HiddenItem) => `${item.kind}-${item.id}`;

interface Props {
  /** The list whose hidden items to show (?list=…), or the default list. */
  listRef: ListRef;
  onAccessChanged: () => void;
  onNavigate: Navigate;
}

// Hidden items, Stage 5b (US-13a): everything hidden on its own from the list, newest first, with Restore.
// Restoring brings the same item back in its old place, so its history stays attached. Admin-only (server enforced).
export function HiddenItemsPage({ listRef, onAccessChanged, onNavigate }: Props) {
  const hidden = useHiddenItems({ listRef, onAccessChanged });
  const [restoring, setRestoring] = useState<string | null>(null);
  const [ask, setAsk] = useState<HiddenItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const dismissNotice = useCallback(() => setNotice(null), []);

  const { state } = hidden;
  if (state.status === "loading") return <LoadingState label="Loading hidden items…" />;
  if (state.status === "error") {
    return (
      <main className="mx-auto max-w-app px-4 py-6 md:px-6">
        <ErrorState title="Couldn't load hidden items" message={state.message} onRetry={hidden.reload} />
      </main>
    );
  }
  const { list, items, timeZone } = state.data;

  const restore = async (item: HiddenItem, withParents: boolean) => {
    setRestoring(itemKey(item));
    const ok = await hidden.restore(item.kind, item.id, withParents);
    setRestoring(null);
    if (!ok) return;
    setAsk(null);
    const where = parentsOf(item)
      .map((p) => p.name)
      .join(" › ");
    setNotice(
      `Restored “${item.name}”${where ? ` to ${where}` : ""}.${
        item.kind === "category" ? " Planning Center links it had were removed when it was hidden; link its teams again." : ""
      }`,
    );
  };

  const asking = ask ? hiddenParentsOf(ask) : [];

  return (
    <main className="mx-auto max-w-4xl space-y-4 px-4 pt-4 pb-24 md:px-6 md:pt-6">
      <RouteLink
        to="admin-checklist"
        search={listRef === "default" ? "" : `?list=${listRef}`}
        current={false}
        onNavigate={onNavigate}
        className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-control px-2 text-sm text-accent-soft hover:bg-hover"
      >
        <span aria-hidden="true">←</span> Back to checklist
      </RouteLink>

      <PageHeader title="Hidden items" description={list.name} actions={<SaveIndicator state={hidden.saveState} />} />

      <p className="text-sm text-fg-muted">
        Hidden items aren't on anyone's checklist, but nothing was erased. Restore brings an item back where it was, with its
        history. Items inside a hidden department or section come back with it.
      </p>

      {items.length === 0 ? (
        <EmptyState title="Nothing is hidden." message="Departments, sections and tasks you hide appear here, so you can bring them back." />
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {items.map((item) => {
              const parents = parentsOf(item);
              const contents = [
                item.sectionCount ? plural(item.sectionCount, "section") : "",
                item.taskCount ? plural(item.taskCount, "task") : "",
              ].filter(Boolean);
              const busy = restoring === itemKey(item);
              return (
                <li key={itemKey(item)} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3 sm:flex-nowrap">
                  <div className="min-w-0 flex-1 basis-56 space-y-0.5">
                    <p className="text-meta font-semibold tracking-wide text-fg-muted uppercase">{KIND_LABEL[item.kind]}</p>
                    {/* Long task text is clamped so the list stays scannable; the full text is in the tooltip. */}
                    <p className="line-clamp-3 font-medium wrap-anywhere" title={item.name}>
                      {item.name}
                    </p>
                    {parents.length > 0 && (
                      <p className="text-meta text-fg-muted wrap-anywhere">
                        In{" "}
                        {parents.map((p, i) => (
                          <span key={p.kind}>
                            {i > 0 && " › "}
                            {p.name}
                            {p.hidden && <span className="text-warning"> (hidden)</span>}
                          </span>
                        ))}
                      </p>
                    )}
                    <p className="text-meta text-fg-muted">
                      Hidden {formatDateTime(item.hiddenAt, timeZone)}
                      {contents.length > 0 && ` · brings back ${contents.join(" and ")}`}
                    </p>
                  </div>
                  <Button
                    onClick={() => (hiddenParentsOf(item).length > 0 ? setAsk(item) : void restore(item, false))}
                    disabled={restoring !== null}
                    aria-label={`Restore ${KIND_LABEL[item.kind].toLowerCase()}: ${item.name}`}
                  >
                    {busy && !ask ? "Restoring…" : "Restore"}
                  </Button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <ConfirmDialog
        open={ask !== null}
        title={asking.length > 1 ? "Restore its section and department too?" : `Restore its ${asking[0] ? KIND_LABEL[asking[0].kind].toLowerCase() : "parent"} too?`}
        confirmLabel={asking.length > 1 ? "Restore all three" : "Restore both"}
        busy={restoring !== null}
        error={ask ? hidden.error : null}
        onConfirm={() => ask && void restore(ask, true)}
        onCancel={() => {
          hidden.dismissError();
          setAsk(null);
        }}
      >
        {ask && (
          <>
            <p className="font-medium text-fg wrap-anywhere">“{ask.name}”</p>
            <p>
              It's in {describeParents(asking)}, which {asking.length > 1 ? "are" : "is"} hidden. A {KIND_LABEL[ask.kind].toLowerCase()} can
              only come back inside a visible {ask.kind === "task" ? "section and department" : "department"}.
            </p>
            {asking.some((p) => p.kind === "category") && (
              <p>Restoring the department also brings back everything in it that wasn't hidden on its own.</p>
            )}
            <p>Or cancel and restore {asking.length > 1 ? "them" : "it"} on {asking.length > 1 ? "their" : "its"} own first.</p>
          </>
        )}
      </ConfirmDialog>

      <ErrorFeedback message={ask ? null : hidden.error} onDismiss={hidden.dismissError} />
      <NoticeFeedback message={notice} onDismiss={dismissNotice} />
    </main>
  );
}
