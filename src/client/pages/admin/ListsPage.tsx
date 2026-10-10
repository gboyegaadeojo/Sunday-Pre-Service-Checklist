import { type FormEvent, useCallback, useId, useState } from "react";
import { type AdminListSummary, DESCRIPTION_MAX, NAME_MAX } from "../../../shared/types";
import { RouteLink } from "../../components/app/RouteLink";
import { SaveIndicator } from "../../components/checklist/SaveIndicator";
import { ActionMenu } from "../../components/ui/ActionMenu";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { ErrorFeedback, NoticeFeedback } from "../../components/ui/Feedback";
import { ErrorState, LoadingState } from "../../components/ui/States";
import { plural } from "../../lib/checklist";
import { formatServiceDate } from "../../lib/format";
import type { Navigate } from "../../lib/router";
import { useLists } from "../../lib/useAdminList";

const FIELD =
  "w-full rounded-control border border-line bg-bg px-3 py-2.5 text-base text-fg placeholder:text-fg-muted focus-visible:border-accent-soft";

interface FormValues {
  name: string;
  description: string;
  copyFrom: number | null;
}

/** Name and description, plus "Start from" when creating. 16px fields so phones don't zoom. */
function ListForm({
  initial,
  sources,
  saveLabel,
  onSave,
  onCancel,
}: {
  initial: FormValues;
  /** Lists a new list can copy; omitted when editing an existing list. */
  sources?: AdminListSummary[];
  saveLabel: string;
  onSave: (values: FormValues) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const id = useId();
  const set = (patch: Partial<FormValues>) => setValues((v) => ({ ...v, ...patch }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!values.name.trim() || busy) return;
    setBusy(true);
    const saved = await onSave(values);
    setBusy(false);
    if (saved) onCancel();
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-3">
      <div>
        <label htmlFor={`${id}-name`} className="mb-1 block text-meta font-medium text-fg-muted">
          Name
        </label>
        <input
          id={`${id}-name`}
          // biome-ignore lint/a11y/noAutofocus: the form opens on request, so its first field should take focus
          autoFocus
          value={values.name}
          maxLength={NAME_MAX}
          onChange={(e) => set({ name: e.target.value })}
          className={FIELD}
        />
      </div>
      <div>
        <label htmlFor={`${id}-description`} className="mb-1 block text-meta font-medium text-fg-muted">
          Description (optional)
        </label>
        <textarea
          id={`${id}-description`}
          rows={2}
          value={values.description}
          maxLength={DESCRIPTION_MAX}
          onChange={(e) => set({ description: e.target.value })}
          className={`${FIELD} resize-none`}
        />
      </div>
      {sources && (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-meta font-medium text-fg-muted">Start from</legend>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
            <input
              type="radio"
              name={`${id}-start`}
              checked={values.copyFrom === null}
              onChange={() => set({ copyFrom: null })}
              className="size-4 accent-accent"
            />
            An empty list
          </label>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
              <input
                type="radio"
                name={`${id}-start`}
                checked={values.copyFrom !== null}
                onChange={() => set({ copyFrom: sources[0]?.id ?? null })}
                disabled={sources.length === 0}
                className="size-4 accent-accent"
              />
              A copy of
            </label>
            <select
              aria-label="List to copy"
              value={values.copyFrom ?? ""}
              onChange={(e) => set({ copyFrom: Number(e.target.value) })}
              disabled={values.copyFrom === null}
              className="min-h-11 min-w-0 flex-1 rounded-control border border-line bg-bg px-3 text-base text-fg disabled:opacity-50"
            >
              {values.copyFrom === null && <option value="">Choose a list</option>}
              {sources.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          {values.copyFrom !== null && (
            <p className="text-meta text-fg-muted">
              Copies its departments, sections and tasks. Hidden items and Planning Center links aren't copied.
            </p>
          )}
        </fieldset>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" disabled={!values.name.trim() || busy}>
          {busy ? "Saving…" : saveLabel}
        </Button>
        <Button onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

type Dialog = { kind: "default"; list: AdminListSummary } | { kind: "hide"; list: AdminListSummary } | null;

interface Props {
  onAccessChanged: () => void;
  onNavigate: Navigate;
}

// Task lists, Stage 5d.1 (US-11; design.md §7 Checklist Management): create (empty or as a copy), rename and
// describe, choose the default for new services, hide and restore. Admin-only (server enforced).
export function ListsPage({ onAccessChanged, onNavigate }: Props) {
  const lists = useLists({ onAccessChanged });
  const [creating, setCreating] = useState<FormValues | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [applyToService, setApplyToService] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const dismissNotice = useCallback(() => setNotice(null), []);
  const applyId = useId();

  const { state } = lists;
  if (state.status === "loading") return <LoadingState label="Loading lists…" />;
  if (state.status === "error") {
    return (
      <main className="mx-auto max-w-app px-4 py-6 md:px-6">
        <ErrorState title="Couldn't load the lists" message={state.message} onRetry={lists.reload} />
      </main>
    );
  }

  const { currentService } = state.data;
  const live = state.data.lists.filter((l) => l.hiddenAt === null);
  const hidden = state.data.lists.filter((l) => l.hiddenAt !== null);
  const serviceList = live.find((l) => l.id === currentService?.listId);
  const serviceDate = currentService ? formatServiceDate(currentService.date) : null;

  const create = async (values: FormValues) => {
    const id = await lists.create({ name: values.name, description: values.description || null, copyFrom: values.copyFrom ?? undefined });
    if (id === null) return false;
    onNavigate("admin-checklist", `?list=${id}`); // straight to building it
    return true;
  };

  const confirm = async () => {
    if (!dialog) return;
    setBusy(true);
    if (dialog.kind === "default") {
      const switched = await lists.setDefault(dialog.list.id, applyToService);
      if (switched !== null) {
        setNotice(
          `“${dialog.list.name}” is now the default list.${switched && serviceDate ? ` ${serviceDate} uses it too.` : ""}`,
        );
        setDialog(null);
      }
    } else if (await lists.hide(dialog.list.id)) {
      setNotice(`Hid “${dialog.list.name}”. You can restore it under Hidden lists.`);
      setDialog(null);
    }
    setBusy(false);
  };

  const openDefault = (list: AdminListSummary) => {
    setApplyToService(false);
    setDialog({ kind: "default", list });
  };

  // Hiding is refused by the server for these; the menu says why instead of offering it.
  const hideBlocker = (l: AdminListSummary) =>
    l.isDefault ? "Can't hide: default list" : l.id === currentService?.listId ? "Can't hide: used by this service" : null;

  return (
    <main className="mx-auto max-w-4xl space-y-4 px-4 pt-4 pb-24 md:px-6 md:pt-6">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h1 className="text-page font-semibold tracking-tight">Task lists</h1>
          <p className="text-meta text-fg-muted">
            New services use the default list. A service keeps the list it started with.
            {serviceDate && serviceList && (
              <>
                {" "}
                {serviceDate} uses <span className="font-medium text-fg">{serviceList.name}</span>.
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {!creating && (
            <Button variant="primary" onClick={() => setCreating({ name: "", description: "", copyFrom: null })}>
              New list
            </Button>
          )}
          <SaveIndicator state={lists.saveState} />
        </div>
      </header>

      {creating && (
        <Card className="p-4">
          <h2 className="mb-3 font-semibold">New list</h2>
          <ListForm initial={creating} sources={live} saveLabel="Create list" onSave={create} onCancel={() => setCreating(null)} />
        </Card>
      )}

      <ul className="space-y-3">
        {live.map((l) => (
          <li key={l.id}>
            <Card className="p-4">
              {editingId === l.id ? (
                <ListForm
                  initial={{ name: l.name, description: l.description ?? "", copyFrom: null }}
                  saveLabel="Save"
                  onSave={(v) => lists.update(l.id, v.name, v.description || null)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg leading-snug font-semibold wrap-anywhere">{l.name}</h2>
                      {l.isDefault && (
                        <span className="rounded-full bg-accent/20 px-2 py-0.5 text-meta font-medium text-accent-soft">Default</span>
                      )}
                      {l.id === currentService?.listId && (
                        <span className="rounded-full border border-line px-2 py-0.5 text-meta text-fg-muted">This service</span>
                      )}
                    </div>
                    {l.description && <p className="text-sm text-fg-muted wrap-anywhere">{l.description}</p>}
                    <p className="text-meta text-fg-muted">
                      {plural(l.departmentCount, "department")} · {plural(l.taskCount, "task")}
                    </p>
                    <RouteLink
                      to="admin-checklist"
                      search={`?list=${l.id}`}
                      current={false}
                      onNavigate={onNavigate}
                      className="mt-2 inline-flex min-h-11 items-center rounded-control border border-line bg-card px-4 text-sm font-medium text-fg transition-colors hover:bg-hover"
                    >
                      Edit checklist
                    </RouteLink>
                  </div>
                  <ActionMenu
                    id={`list-menu-${l.id}`}
                    label={`Actions for list: ${l.name}`}
                    items={[
                      { label: "Rename or describe", onSelect: () => setEditingId(l.id) },
                      ...(l.isDefault ? [] : [{ label: "Make default", onSelect: () => openDefault(l) }]),
                      {
                        label: "Copy to a new list",
                        onSelect: () => setCreating({ name: `${l.name} (copy)`, description: l.description ?? "", copyFrom: l.id }),
                      },
                      {
                        label: hideBlocker(l) ?? "Hide list",
                        danger: true,
                        disabled: hideBlocker(l) !== null,
                        onSelect: () => setDialog({ kind: "hide", list: l }),
                      },
                    ]}
                  />
                </div>
              )}
            </Card>
          </li>
        ))}
      </ul>

      {hidden.length > 0 && (
        <section aria-labelledby="hidden-lists" className="space-y-2 pt-4">
          <h2 id="hidden-lists" className="text-meta font-semibold tracking-wide text-fg-muted uppercase">
            Hidden lists
          </h2>
          <Card>
            <ul className="divide-y divide-line">
              {hidden.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium wrap-anywhere">{l.name}</p>
                    <p className="text-meta text-fg-muted">
                      {plural(l.departmentCount, "department")} · {plural(l.taskCount, "task")}
                    </p>
                  </div>
                  <Button
                    aria-label={`Restore list: ${l.name}`}
                    onClick={() => void lists.restore(l.id).then((ok) => ok && setNotice(`Restored “${l.name}”.`))}
                  >
                    Restore
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      <ConfirmDialog
        open={dialog !== null}
        title={dialog ? (dialog.kind === "default" ? `Make “${dialog.list.name}” the default?` : `Hide “${dialog.list.name}”?`) : ""}
        confirmLabel={dialog?.kind === "hide" ? "Hide list" : "Make default"}
        tone={dialog?.kind === "hide" ? "danger" : "primary"}
        busy={busy}
        error={dialog ? lists.error : null}
        onConfirm={() => void confirm()}
        onCancel={() => {
          lists.dismissError();
          setDialog(null);
        }}
      >
        {dialog?.kind === "default" && (
          <>
            <p>New services will use this list for everyone.</p>
            {currentService && serviceList && currentService.listId !== dialog.list.id && (
              currentService.hasCheckoffs ? (
                <p>
                  {serviceDate} already has check-offs, so it keeps “{serviceList.name}”.
                </p>
              ) : (
                <label htmlFor={applyId} className="flex min-h-11 cursor-pointer items-center gap-3 text-fg">
                  <input
                    id={applyId}
                    type="checkbox"
                    checked={applyToService}
                    onChange={(e) => setApplyToService(e.target.checked)}
                    className="size-4 accent-accent"
                  />
                  Also use it for {serviceDate} (it has no check-offs yet)
                </label>
              )
            )}
          </>
        )}
        {dialog?.kind === "hide" && (
          <>
            <p>It leaves this page and can't be edited or used for new services.</p>
            <p>Nothing is erased: past services that used it keep their records, and you can restore it under Hidden lists.</p>
          </>
        )}
      </ConfirmDialog>

      <ErrorFeedback message={dialog ? null : lists.error} onDismiss={lists.dismissError} />
      <NoticeFeedback message={notice} onDismiss={dismissNotice} />
    </main>
  );
}
