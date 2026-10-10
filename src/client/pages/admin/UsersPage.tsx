import { useCallback, useId, useState } from "react";
import type { CurrentUser, RoleField, UserSummary } from "../../../shared/types";
import { SaveIndicator } from "../../components/checklist/SaveIndicator";
import { Avatar } from "../../components/ui/Avatar";
import { Card } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { ErrorFeedback, NoticeFeedback } from "../../components/ui/Feedback";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/States";
import type { Navigate } from "../../lib/router";
import { useUsers } from "../../lib/useAdminList";

interface Props {
  /** The signed-in Admin. */
  me: CurrentUser;
  onAccessChanged: () => void;
  onNavigate: Navigate;
}

const ROLE_LABEL: Record<RoleField, string> = { isAdmin: "Admin", isDirector: "Director" };

/** What a person can do, in words. */
function status(u: UserSummary): string {
  const roles = [u.isAdmin && "Admin", u.isDirector && "Director"].filter(Boolean).join(" · ");
  if (roles) return roles;
  return u.onMediaTeam ? "Volunteer" : "No access: not on a media team";
}

/** "Oct 4, 2026" in the church's time zone, or "never". */
const lastSeen = (iso: string | null, timeZone: string) =>
  iso ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", timeZone }).format(new Date(iso)) : "never";

// People and their roles (Stage 6, US-03; design.md §7 "Users and Permissions"). Admins grant or revoke Admin and
// Director. The server enforces who may do this, refuses to remove the last Admin, and logs every change. A change
// takes effect the next time that person loads the app.
export function UsersPage({ me, onAccessChanged, onNavigate }: Props) {
  const users = useUsers({ onAccessChanged });
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmStepDown, setConfirmStepDown] = useState<UserSummary | null>(null);
  const dismissNotice = useCallback(() => setNotice(null), []);
  const searchId = useId();

  const { state } = users;
  if (state.status === "loading") return <LoadingState label="Loading people…" />;
  if (state.status === "error") {
    return (
      <main className="mx-auto max-w-app px-4 py-6 md:px-6">
        <ErrorState title="Couldn't load people" message={state.message} onRetry={users.reload} />
      </main>
    );
  }

  const { timeZone } = state.data;
  const adminCount = state.data.users.filter((u) => u.isAdmin).length;
  const q = query.trim().toLocaleLowerCase();
  const shown = q ? state.data.users.filter((u) => u.name.toLocaleLowerCase().includes(q)) : state.data.users;

  const save = async (u: UserSummary, field: RoleField, value: boolean) => {
    setBusyId(u.id);
    const saved = await users.setRoles(u.id, { isAdmin: u.isAdmin, isDirector: u.isDirector, [field]: value });
    setBusyId(null);
    if (!saved) return;
    setNotice(`${u.id === me.id ? "You are" : `${u.name} is`} ${value ? "now" : "no longer"} ${field === "isAdmin" ? "an Admin" : "a Director"}.`);
    // Stepping down from Admin: this page is no longer theirs.
    if (u.id === me.id && field === "isAdmin" && !value) {
      onAccessChanged();
      onNavigate("checklist");
    }
  };

  const toggle = (u: UserSummary, field: RoleField) => {
    if (u.id === me.id && field === "isAdmin" && u.isAdmin) setConfirmStepDown(u);
    else void save(u, field, !u[field]);
  };

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 pt-4 pb-24 md:px-6 md:pt-6">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h1 className="text-page font-semibold tracking-tight">Users</h1>
          <p className="text-meta text-fg-muted">
            Everyone who has signed in. Admins manage the checklist, lists, people and settings; Directors can reset and undo.
            Admins and Directors can always get in. Changes take effect the next time that person loads the app.
          </p>
        </div>
        <SaveIndicator state={users.saveState} />
      </header>

      <div>
        <label htmlFor={searchId} className="mb-1 block text-meta font-medium text-fg-muted">
          Search by name
        </label>
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-control border border-line bg-bg px-3 py-2.5 text-base text-fg placeholder:text-fg-muted focus-visible:border-accent-soft"
        />
      </div>

      {shown.length === 0 ? (
        <EmptyState title={q ? `No one named “${query.trim()}”.` : "No one has signed in yet."} />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {shown.map((u) => {
              const onlyAdmin = u.isAdmin && adminCount === 1;
              return (
                <li key={u.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <div className="flex min-w-0 flex-1 basis-56 items-center gap-3">
                    <Avatar name={u.name} url={u.avatarUrl} className="size-9" />
                    <div className="min-w-0">
                      <p className="font-medium wrap-anywhere">
                        {u.name}
                        {u.id === me.id && <span className="ml-2 rounded-control border border-line px-1.5 text-meta font-normal text-fg-muted">You</span>}
                      </p>
                      <p className={`text-meta wrap-anywhere ${u.isAdmin || u.isDirector || u.onMediaTeam ? "text-fg-muted" : "text-warning"}`}>
                        {status(u)} · last seen {lastSeen(u.lastSeenAt, timeZone)}
                      </p>
                      {onlyAdmin && <p className="text-meta text-fg-muted">The only Admin, so this role can't be removed.</p>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {(["isAdmin", "isDirector"] as const).map((field) => (
                      <RoleSwitch
                        key={field}
                        label={ROLE_LABEL[field]}
                        person={u.name}
                        on={u[field]}
                        disabled={busyId !== null || (field === "isAdmin" && onlyAdmin)}
                        onToggle={() => toggle(u, field)}
                      />
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <ConfirmDialog
        open={confirmStepDown !== null}
        title="Remove your own Admin role?"
        confirmLabel="Remove my Admin role"
        tone="danger"
        busy={busyId !== null}
        onCancel={() => setConfirmStepDown(null)}
        onConfirm={async () => {
          const u = confirmStepDown;
          setConfirmStepDown(null);
          if (u) await save(u, "isAdmin", false);
        }}
      >
        You'll lose access to the Admin area and Settings straight away. Another Admin can give it back.
      </ConfirmDialog>

      <ErrorFeedback message={users.error} onDismiss={users.dismissError} />
      <NoticeFeedback message={notice} onDismiss={dismissNotice} />
    </main>
  );
}

/** An on/off switch with its role name visible; 44px tall (design.md §10). */
function RoleSwitch({ label, person, on, disabled, onToggle }: { label: string; person: string; on: boolean; disabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`${label}: ${person}`}
      disabled={disabled}
      onClick={onToggle}
      className={`flex min-h-11 items-center gap-2 rounded-control border px-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        on ? "border-accent bg-accent/15 text-fg" : "border-line bg-card text-fg-muted hover:bg-hover"
      }`}
    >
      <span aria-hidden="true" className={`relative h-4 w-7 rounded-full transition-colors ${on ? "bg-accent" : "bg-line"}`}>
        <span className={`absolute top-0.5 size-3 rounded-full bg-white transition-[left] ${on ? "left-3.5" : "left-0.5"}`} />
      </span>
      {label}
    </button>
  );
}
