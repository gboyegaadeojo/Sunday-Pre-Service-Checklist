import { useCallback, useEffect, useState } from "react";
import { NAME_MAX, type StructureKind } from "../../../shared/types";
import { AddButton } from "../../components/admin/AddButton";
import { EditorCategory } from "../../components/admin/EditorCategory";
import {
  type Editing,
  EditorContext,
  type HideRequest,
  type MoveRequest,
  itemKey,
  menuButtonId,
} from "../../components/admin/editor-context";
import { MoveDialog } from "../../components/admin/MoveDialog";
import { TextEditor } from "../../components/admin/TextEditor";
import { RouteLink } from "../../components/app/RouteLink";
import { SaveIndicator } from "../../components/checklist/SaveIndicator";
import { Card } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { ErrorFeedback, NoticeFeedback } from "../../components/ui/Feedback";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/States";
import type { Route } from "../../lib/router";
import { useAdminList } from "../../lib/useAdminList";

const HIDE_TITLE: Record<HideRequest["kind"], string> = { category: "department", section: "section", task: "task" };

/** Puts focus back on an item's "⋯" button once it has re-rendered in its new place. */
const focusMenu = (kind: StructureKind, id: number) =>
  requestAnimationFrame(() => document.getElementById(menuButtonId(kind, id))?.focus());

interface Props {
  onAccessChanged: () => void;
  onNavigate: (route: Route) => void;
}

// Admin checklist editor, Stage 5 (US-12, US-12a, US-13; design.md §7): add, rename/edit, hide, reorder
// and move departments, sections and tasks. Changes are live for everyone once saved. Admin-only (server enforced).
export function ChecklistEditorPage({ onAccessChanged, onNavigate }: Props) {
  const actions = useAdminList({ onAccessChanged });
  const [editing, setEditing] = useState<Editing>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
  const [hide, setHide] = useState<HideRequest | null>(null);
  const [hiding, setHiding] = useState(false);
  const [move, setMove] = useState<MoveRequest | null>(null);
  const [moving, setMoving] = useState(false);
  const [recent, setRecent] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const dismissNotice = useCallback(() => setNotice(null), []);

  // The highlight on a moved item fades after a moment.
  useEffect(() => {
    if (!recent) return;
    const timer = setTimeout(() => setRecent(null), 2000);
    return () => clearTimeout(timer);
  }, [recent]);

  const { state } = actions;
  if (state.status === "loading") return <LoadingState label="Loading checklist…" />;
  if (state.status === "error") {
    return (
      <main className="mx-auto max-w-app px-4 py-6 md:px-6">
        <ErrorState title="Couldn't load the checklist" message={state.message} onRetry={actions.reload} />
      </main>
    );
  }

  const { list, categories } = state.data;
  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const confirmHide = async () => {
    if (!hide) return;
    setHiding(true);
    const run = { category: actions.hideCategory, section: actions.hideSection, task: actions.hideTask }[hide.kind];
    const ok = await run(hide.id);
    setHiding(false);
    if (ok) setHide(null);
  };

  const reorderItem = async (kind: StructureKind, id: number, direction: "up" | "down") => {
    if (!(await actions.reorder(kind, id, direction))) return;
    setRecent(itemKey(kind, id));
    focusMenu(kind, id);
  };

  const confirmMove = async (destinationId: number) => {
    if (!move) return;
    // Where it's going, named from the list as shown, for the confirmation message.
    const department =
      move.kind === "task" ? categories.find((c) => c.sections.some((s) => s.id === destinationId)) : categories.find((c) => c.id === destinationId);
    const section = department?.sections.find((s) => s.id === destinationId);
    setMoving(true);
    const ok = move.kind === "task" ? await actions.moveTask(move.id, destinationId) : await actions.moveSection(move.id, destinationId);
    setMoving(false);
    if (!ok) return;
    // Open the destination so the moved item is visible there.
    if (department) setExpanded((prev) => new Set(prev).add(department.id));
    setRecent(itemKey(move.kind, move.id));
    setNotice(`Moved “${move.name}” to ${[department?.name, move.kind === "task" ? section?.name : undefined].filter(Boolean).join(" › ")}.`);
    focusMenu(move.kind, move.id);
    setMove(null);
  };

  return (
    <EditorContext.Provider
      value={{
        editing,
        setEditing,
        actions,
        requestHide: setHide,
        requestMove: setMove,
        reorderItem: (kind, id, direction) => void reorderItem(kind, id, direction),
        recent,
      }}
    >
      <main className="mx-auto max-w-4xl space-y-4 px-4 pt-4 pb-24 md:px-6 md:pt-6">
        <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
          <div className="min-w-0">
            <h1 className="text-page font-semibold tracking-tight">Checklist</h1>
            <p className="text-meta text-fg-muted">
              {list.name}
              {list.isDefault && " · used for regular services"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <SaveIndicator state={actions.saveState} />
            <RouteLink
              to="admin-hidden"
              current={false}
              onNavigate={onNavigate}
              className="inline-flex min-h-11 items-center rounded-control border border-line bg-card px-4 text-sm font-medium text-fg transition-colors hover:bg-hover"
            >
              Hidden items
            </RouteLink>
          </div>
        </header>

        <p className="text-sm text-fg-muted">
          Changes are live for everyone as soon as you save. Hidden items disappear from checklists, and past services keep
          their records. Use each item's ⋯ menu to move or reorder it.
        </p>

        {categories.length === 0 && editing?.kind !== "add-category" && (
          <EmptyState title="This checklist has no departments yet." message="Add one to start building the checklist." />
        )}

        <div className="space-y-3">
          {categories.map((c, i) => (
            <EditorCategory
              key={c.id}
              category={c}
              position={{ first: i === 0, last: i === categories.length - 1 }}
              expanded={expanded.has(c.id)}
              onToggle={() => toggle(c.id)}
            />
          ))}
        </div>

        {editing?.kind === "add-category" ? (
          <Card className="p-4">
            <TextEditor
              label="New department"
              maxLength={NAME_MAX}
              saveLabel="Add department"
              onSave={actions.addCategory}
              onCancel={() => setEditing(null)}
            />
          </Card>
        ) : (
          <AddButton label="Add department" onClick={() => setEditing({ kind: "add-category" })} />
        )}

        <ConfirmDialog
          open={hide !== null}
          title={hide ? `Hide this ${HIDE_TITLE[hide.kind]}?` : ""}
          confirmLabel={hide ? `Hide ${HIDE_TITLE[hide.kind]}` : "Hide"}
          tone="danger"
          busy={hiding}
          error={hide ? actions.error : null}
          onConfirm={() => void confirmHide()}
          onCancel={() => setHide(null)}
        >
          {hide && (
            <>
              <p className="font-medium text-fg wrap-anywhere">“{hide.name}”</p>
              <p>It disappears from the checklist and progress view for everyone, starting now.</p>
              {hide.details.map((d) => (
                <p key={d}>{d}</p>
              ))}
              <p>Nothing is erased: past services keep their records, including check-offs already made. You can restore it from Hidden items.</p>
            </>
          )}
        </ConfirmDialog>

        <MoveDialog
          key={move ? itemKey(move.kind, move.id) : "closed"}
          request={move}
          categories={categories}
          busy={moving}
          error={move ? actions.error : null}
          onMove={(id) => void confirmMove(id)}
          onCancel={() => {
            actions.dismissError();
            setMove(null);
          }}
        />

        <ErrorFeedback message={hide || move ? null : actions.error} onDismiss={actions.dismissError} />
        <NoticeFeedback message={notice} onDismiss={dismissNotice} />
      </main>
    </EditorContext.Provider>
  );
}
