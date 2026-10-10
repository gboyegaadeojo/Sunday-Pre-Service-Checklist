import { useCallback, useEffect, useRef, useState } from "react";
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
  reorderButtonId,
} from "../../components/admin/editor-context";
import { MoveDialog } from "../../components/admin/MoveDialog";
import { TextEditor } from "../../components/admin/TextEditor";
import { RouteLink } from "../../components/app/RouteLink";
import { SaveIndicator } from "../../components/checklist/SaveIndicator";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { ErrorFeedback, NoticeFeedback } from "../../components/ui/Feedback";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/States";
import type { Navigate } from "../../lib/router";
import { type ListRef, useAdminList } from "../../lib/useAdminList";

const HIDE_TITLE: Record<HideRequest["kind"], string> = { category: "department", section: "section", task: "task" };

/** Where focus goes once a moved item has re-rendered: the first of these IDs that is present and enabled. */
type FocusTarget = string[];

const REORDER_START = "editor-reorder-start";
const REORDER_DONE = "editor-reorder-done";

interface Props {
  /** The list to edit (?list=…), or the default list. */
  listRef: ListRef;
  onAccessChanged: () => void;
  onNavigate: Navigate;
}

// Admin checklist editor, Stage 5 (US-12, US-12a, US-13; design.md §7): add, rename/edit, hide, reorder
// and move departments, sections and tasks. Changes are live for everyone once saved. Admin-only (server enforced).
export function ChecklistEditorPage({ listRef, onAccessChanged, onNavigate }: Props) {
  const actions = useAdminList({ listRef, onAccessChanged });
  const [editing, setEditing] = useState<Editing>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
  const [hide, setHide] = useState<HideRequest | null>(null);
  const [hiding, setHiding] = useState(false);
  const [move, setMove] = useState<MoveRequest | null>(null);
  const [moving, setMoving] = useState(false);
  const [recent, setRecent] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const dismissNotice = useCallback(() => setNotice(null), []);
  const [reordering, setReordering] = useState(false);
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);
  const reorderBusy = useRef(false);

  // Keep focus on a moved item (its ⋯ button, or the same arrow in Reorder mode, or the other arrow once
  // it reaches an end), so repeated moves need no hunting. Runs after each render until it lands.
  useEffect(() => {
    if (!focusTarget) return;
    const el = focusTarget.map((id) => document.getElementById(id) as HTMLButtonElement | null).find((b) => b && !b.disabled);
    if (el) {
      el.focus();
      setFocusTarget(null);
    }
  });

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
    // One move at a time: a tap while the last one is saving is ignored, so arrows never act on stale positions.
    if (reorderBusy.current) return;
    reorderBusy.current = true;
    const ok = await actions.reorder(kind, id, direction);
    reorderBusy.current = false;
    if (!ok) return;
    setRecent(itemKey(kind, id));
    const other = direction === "up" ? "down" : "up";
    setFocusTarget(
      reordering ? [reorderButtonId(kind, id, direction), reorderButtonId(kind, id, other)] : [menuButtonId(kind, id)],
    );
  };

  // The button that was pressed disappears, so focus moves to its counterpart (Done, or Reorder again).
  const toggleReordering = () => {
    setEditing(null);
    setFocusTarget([reordering ? REORDER_START : REORDER_DONE]);
    setReordering(!reordering);
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
    setFocusTarget([menuButtonId(move.kind, move.id)]);
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
        reordering,
      }}
    >
      <main className="mx-auto max-w-4xl space-y-4 px-4 pt-4 pb-24 md:px-6 md:pt-6">
        <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
          <div className="min-w-0">
            <h1 className="text-page font-semibold tracking-tight">Checklist</h1>
            <p className="text-meta text-fg-muted">
              <span className="font-medium text-fg">{list.name}</span>
              {list.isDefault ? " · the default list for new services" : " · not the default list"}
              {" · "}
              <RouteLink to="admin-lists" current={false} onNavigate={onNavigate} className="text-accent-soft underline-offset-2 hover:underline">
                All lists
              </RouteLink>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {/* Starts Reorder mode; the sticky bar below holds Done while it's on. */}
            {!reordering && (
              <Button id={REORDER_START} onClick={toggleReordering}>
                Reorder
              </Button>
            )}
            <RouteLink
              to="admin-hidden"
              search={`?list=${list.id}`}
              current={false}
              onNavigate={onNavigate}
              className="inline-flex min-h-11 items-center rounded-control border border-line bg-card px-4 text-sm font-medium text-fg transition-colors hover:bg-hover"
            >
              Hidden items
            </RouteLink>
            {/* Last, so its empty idle state doesn't push the buttons in. */}
            <SaveIndicator state={actions.saveState} />
          </div>
        </header>

        {reordering ? (
          // Stays in view while scrolling (below the app header), so leaving the mode is always one tap away.
          <div className="sticky top-14 z-20 -mx-4 flex items-center justify-between gap-3 border-b border-line bg-bg px-4 py-2 md:-mx-6 md:px-6">
            <p className="min-w-0 text-sm">
              <span className="font-semibold">Reordering.</span>{" "}
              <span className="text-fg-muted">Use the arrows to move items. Each move saves right away.</span>
            </p>
            <Button id={REORDER_DONE} variant="primary" onClick={toggleReordering}>
              Done
            </Button>
          </div>
        ) : (
          <p className="text-sm text-fg-muted">
            Changes are live for everyone as soon as you save. Hidden items disappear from checklists, and past services keep
            their records. Use each item's ⋯ menu to edit, move or hide it, or Reorder to move several items with arrows.
          </p>
        )}

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

        {reordering ? null : editing?.kind === "add-category" ? (
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
