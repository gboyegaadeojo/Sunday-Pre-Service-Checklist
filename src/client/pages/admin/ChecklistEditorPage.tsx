import { useState } from "react";
import { NAME_MAX } from "../../../shared/types";
import { AddButton } from "../../components/admin/AddButton";
import { EditorCategory } from "../../components/admin/EditorCategory";
import { type Editing, EditorContext, type HideRequest } from "../../components/admin/editor-context";
import { TextEditor } from "../../components/admin/TextEditor";
import { SaveIndicator } from "../../components/checklist/SaveIndicator";
import { Card } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { ErrorFeedback } from "../../components/ui/Feedback";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/States";
import { useAdminList } from "../../lib/useAdminList";

const HIDE_TITLE: Record<HideRequest["kind"], string> = { category: "department", section: "section", task: "task" };

// Admin checklist editor, Stage 5a (US-12, US-12a, US-13; design.md §7): add, rename/edit and hide
// departments, sections and tasks. Changes are live for everyone once saved. Admin-only (server enforced).
export function ChecklistEditorPage({ onAccessChanged }: { onAccessChanged: () => void }) {
  const actions = useAdminList({ onAccessChanged });
  const [editing, setEditing] = useState<Editing>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
  const [hide, setHide] = useState<HideRequest | null>(null);
  const [hiding, setHiding] = useState(false);

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

  return (
    <EditorContext.Provider value={{ editing, setEditing, actions, requestHide: setHide }}>
      <main className="mx-auto max-w-4xl space-y-4 px-4 pt-4 pb-24 md:px-6 md:pt-6">
        <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
          <div className="min-w-0">
            <h1 className="text-page font-semibold tracking-tight">Checklist</h1>
            <p className="text-meta text-fg-muted">
              {list.name}
              {list.isDefault && " · used for regular services"}
            </p>
          </div>
          <SaveIndicator state={actions.saveState} />
        </header>

        <p className="text-sm text-fg-muted">
          Changes are live for everyone as soon as you save. Hidden items disappear from checklists, and past services keep
          their records.
        </p>

        {categories.length === 0 && editing?.kind !== "add-category" && (
          <EmptyState title="This checklist has no departments yet." message="Add one to start building the checklist." />
        )}

        <div className="space-y-3">
          {categories.map((c) => (
            <EditorCategory key={c.id} category={c} expanded={expanded.has(c.id)} onToggle={() => toggle(c.id)} />
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
              <p>Nothing is erased: past services keep their records, including check-offs already made.</p>
            </>
          )}
        </ConfirmDialog>

        <ErrorFeedback message={hide ? null : actions.error} onDismiss={actions.dismissError} />
      </main>
    </EditorContext.Provider>
  );
}
