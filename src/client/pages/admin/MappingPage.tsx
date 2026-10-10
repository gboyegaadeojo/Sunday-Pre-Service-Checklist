import { useCallback, useId, useState } from "react";
import type { MappingLink, MappingPosition, MappingResponse, MappingTeam, SetLinkRequest } from "../../../shared/types";
import { MAPPING_CHANGED } from "../../components/admin/AdminLayout";
import { SaveIndicator } from "../../components/checklist/SaveIndicator";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ErrorFeedback, NoticeFeedback } from "../../components/ui/Feedback";
import { AlertIcon, InfoIcon } from "../../components/ui/Icons";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/States";
import { Switch } from "../../components/ui/Switch";
import { plural } from "../../lib/checklist";
import { formatDateTime } from "../../lib/format";
import { useMapping } from "../../lib/useAdminList";

const SELECT =
  "min-h-11 w-full min-w-0 rounded-control border border-line bg-bg px-3 text-base text-fg disabled:opacity-50 sm:w-64 sm:text-sm";

// Team mapping (Stage 7a, US-15; design.md §7). Admins link the schedule's teams and positions to checklist departments:
// people on linked teams can use the app, and scheduled people see their own departments first. Links are kept by the
// source's IDs, so renames don't break them. Nothing is linked automatically. Server first, then reload.
export function MappingPage({ onAccessChanged }: { onAccessChanged: () => void }) {
  const mapping = useMapping({ onAccessChanged });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const dismissNotice = useCallback(() => setNotice(null), []);
  const serviceTypeId = useId();

  const { state } = mapping;
  if (state.status === "loading") return <LoadingState label="Loading teams and positions…" />;
  if (state.status === "error") {
    return (
      <main className="mx-auto max-w-app px-4 py-6 md:px-6">
        <ErrorState title="Couldn't load the team mapping" message={state.message} onRetry={mapping.reload} />
      </main>
    );
  }
  const data = state.data;

  /** Runs a change, then tells the Admin tabs to re-count what needs linking. */
  const change = async (run: () => Promise<boolean>, done?: string) => {
    setBusy(true);
    const ok = await run();
    setBusy(false);
    window.dispatchEvent(new Event(MAPPING_CHANGED));
    if (ok && done) setNotice(done);
    return ok;
  };
  const setLink = (body: SetLinkRequest, done: string) => change(() => mapping.setLink(body), done);

  return (
    <main className="mx-auto max-w-4xl space-y-4 px-4 pt-4 pb-24 md:px-6 md:pt-6">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 max-w-2xl">
          <h1 className="text-page font-semibold tracking-tight">Team mapping</h1>
          <p className="text-meta text-fg-muted">
            Link the teams and positions people are scheduled in to checklist departments. People on a linked team can use the
            app, and people scheduled in a linked position see their department first. Nothing is linked automatically.
          </p>
          <SaveIndicator state={mapping.saveState} />
        </div>
        {data.source && (
          <div className="flex flex-col items-start gap-1">
            <Button onClick={() => void change(mapping.refresh, `Teams and positions refreshed from ${data.source?.label}.`)} disabled={busy}>
              {busy ? "Working…" : `Refresh from ${data.source.label}`}
            </Button>
            {data.fetchedAt && <span className="text-meta text-fg-muted">Fetched {formatDateTime(data.fetchedAt, data.timeZone)}</span>}
          </div>
        )}
      </header>

      {!data.source ? (
        <EmptyState
          title="Planning Center isn't connected yet"
          message="Once it is, its teams and positions appear here to link to departments."
        />
      ) : (
        <>
          <AttentionNotices data={data} busy={busy} onRemove={(m) =>
            void setLink(
              { teamExternalId: m.teamExternalId, positionExternalId: m.positionExternalId, departmentId: null, seesAll: false },
              `Removed the link for ${m.positionName ?? m.teamName}.`,
            )
          } />

          <div>
            <label htmlFor={serviceTypeId} className="mb-1 block text-meta font-medium text-fg-muted">
              Service Type the app follows
            </label>
            <select
              id={serviceTypeId}
              value={data.serviceTypeId ?? ""}
              disabled={busy}
              onChange={(e) => void change(() => mapping.setServiceType(e.target.value), "Service Type saved.")}
              className={SELECT}
            >
              {data.serviceTypeId === null && <option value="">Choose a Service Type</option>}
              {data.serviceTypes.map((t) => (
                <option key={t.externalId} value={t.externalId}>
                  {t.name}
                </option>
              ))}
            </select>
            {data.list && (
              <p className="mt-1 text-meta text-fg-muted">
                Links go to the departments of the default list, “{data.list.name}”.
              </p>
            )}
          </div>

          {data.serviceTypeId === null ? (
            <EmptyState title="Choose the Service Type to see its teams and positions." />
          ) : data.teams.length === 0 ? (
            <EmptyState title="This Service Type has no teams." />
          ) : (
            data.teams.map((team) => (
              <TeamCard
                key={team.externalId}
                team={team}
                data={data}
                busy={busy}
                setLink={setLink}
                setNotMediaTeam={(notMediaTeam) =>
                  change(
                    () => mapping.setNotMediaTeam(team.externalId, notMediaTeam),
                    notMediaTeam ? `${team.name} is marked as not a media team.` : `${team.name} can be linked again.`,
                  )
                }
              />
            ))
          )}
        </>
      )}

      <ErrorFeedback message={mapping.error} onDismiss={mapping.dismissError} />
      <NoticeFeedback message={notice} onDismiss={dismissNotice} />
    </main>
  );
}

/** What the Admin should act on: positions in media teams with no department, and links gone from the source. */
function AttentionNotices({ data, busy, onRemove }: { data: MappingResponse; busy: boolean; onRemove: (m: MappingResponse["missing"][number]) => void }) {
  return (
    <>
      {data.unlinked.length > 0 && (
        <div role="status" className="flex gap-3 rounded-card border border-warning/40 bg-warning/10 p-4 text-sm">
          <AlertIcon className="mt-0.5 size-4 shrink-0 text-warning" />
          <div className="min-w-0">
            <p className="font-medium text-fg">
              {plural(data.unlinked.length, "position")} on a media team {data.unlinked.length === 1 ? "isn't" : "aren't"} linked to a department yet
            </p>
            <p className="text-fg-muted wrap-anywhere">{data.unlinked.map((u) => `${u.team} › ${u.position}`).join(", ")}</p>
            <p className="mt-1 text-meta text-fg-muted">People scheduled there won't see a department of their own until it's linked.</p>
          </div>
        </div>
      )}
      {data.newTeams.length > 0 && (
        <div role="status" className="flex gap-3 rounded-card border border-accent-soft/30 bg-accent/10 p-4 text-sm">
          <InfoIcon className="mt-0.5 size-4 shrink-0 text-accent-soft" />
          <div className="min-w-0">
            <p className="font-medium text-fg wrap-anywhere">
              {data.newTeams.length === 1 ? "New team" : "New teams"} in {data.source?.label}: {data.newTeams.map((t) => t.name).join(", ")}
            </p>
            <p className="text-fg-muted">Link {data.newTeams.length === 1 ? "it" : "each one"} if it's a media team, or mark it “Not a media team”.</p>
          </div>
        </div>
      )}
      {data.missing.length > 0 && (
        <Card className="border-danger/40 p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <AlertIcon className="size-4 shrink-0 text-danger" />
            {data.missing.length === 1 ? "A link points" : `${data.missing.length} links point`} to something no longer in {data.source?.label}
          </p>
          <ul className="mt-2 divide-y divide-line">
            {data.missing.map((m) => (
              <li key={`${m.teamExternalId}/${m.positionExternalId}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2 text-sm">
                <span className="min-w-0 wrap-anywhere">
                  {m.positionName ? `${m.teamName} › ${m.positionName}` : `${m.teamName} (whole team)`}
                  <span className="text-fg-muted"> → {m.department.name}</span>
                </span>
                <Button variant="danger-outline" disabled={busy} onClick={() => onRemove(m)}>
                  Remove link
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

function TeamCard({
  team,
  data,
  busy,
  setLink,
  setNotMediaTeam,
}: {
  team: MappingTeam;
  data: MappingResponse;
  busy: boolean;
  setLink: (body: SetLinkRequest, done: string) => Promise<boolean>;
  setNotMediaTeam: (notMediaTeam: boolean) => Promise<boolean>;
}) {
  const save = (position: MappingPosition | null, link: MappingLink | null, departmentId: number | null, seesAll: boolean) => {
    const name = position ? `${team.name} › ${position.name}` : team.name;
    const dept = data.departments.find((d) => d.id === departmentId)?.name;
    const done =
      departmentId === null
        ? `${name} is no longer linked.`
        : link?.department.id === departmentId
          ? `${name} ${seesAll ? "now sees" : "no longer sees"} all departments.`
          : `${name} is linked to ${dept}.`;
    return setLink({ teamExternalId: team.externalId, positionExternalId: position?.externalId ?? null, departmentId, seesAll }, done);
  };

  // Marked "Not a media team": one line, with Undo. Its positions can't be linked until then.
  if (team.notMediaTeam) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <div className="min-w-0">
          <h2 className="font-semibold wrap-anywhere">{team.name}</h2>
          <p className="text-meta text-fg-muted">Not a media team · {plural(team.positions.length, "position")}, not linked</p>
        </div>
        <Button disabled={busy} onClick={() => void setNotMediaTeam(false)}>
          Undo
        </Button>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 className="font-semibold wrap-anywhere">{team.name}</h2>
          <p className="text-meta text-fg-muted">
            {team.isMediaTeam ? "Media team: its members can use the app" : "New: not linked yet. Link it if it's a media team."}
          </p>
        </div>
        {!team.isMediaTeam && (
          <Button disabled={busy} onClick={() => void setNotMediaTeam(true)}>
            Not a media team
          </Button>
        )}
      </div>
      <ul className="divide-y divide-line">
        <LinkRow
          name="Whole team"
          hint="Positions without their own link follow this."
          link={team.link}
          status={team.link ? "Linked" : "Not linked"}
          tone="muted"
          departments={data.departments}
          noneLabel="Not linked"
          busy={busy}
          onChange={(departmentId, seesAll) => save(null, team.link, departmentId, seesAll)}
        />
        {team.positions.map((p) => (
          <LinkRow
            key={p.externalId}
            name={p.name}
            link={p.link}
            status={p.status === "linked" ? "Linked" : p.status === "team" ? `Follows the team: ${team.link?.department.name}` : "Not linked"}
            tone={p.status === "unlinked" && team.isMediaTeam ? "warning" : "muted"}
            departments={data.departments}
            noneLabel={team.link ? `Same as the team (${team.link.department.name})` : "Not linked"}
            busy={busy}
            onChange={(departmentId, seesAll) => save(p, p.link, departmentId, seesAll)}
          />
        ))}
      </ul>
    </Card>
  );
}

/** One team or position: its department, and whether people scheduled there see all departments. */
function LinkRow({
  name,
  hint,
  link,
  status,
  tone,
  departments,
  noneLabel,
  busy,
  onChange,
}: {
  name: string;
  hint?: string;
  link: MappingLink | null;
  status: string;
  tone: "muted" | "warning";
  departments: MappingResponse["departments"];
  noneLabel: string;
  busy: boolean;
  onChange: (departmentId: number | null, seesAll: boolean) => void;
}) {
  const selectId = useId();
  // A link to a department outside the default list stays selectable, so it shows as it is.
  const options = link?.outsideDefaultList ? [...departments, link.department] : departments;
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <div className="min-w-0 flex-1 basis-48">
        <label htmlFor={selectId} className="block font-medium wrap-anywhere">
          {name}
        </label>
        <p className={`text-meta wrap-anywhere ${tone === "warning" ? "text-warning" : "text-fg-muted"}`}>
          {status}
          {hint && <span className="text-fg-muted"> · {hint}</span>}
        </p>
        {link?.outsideDefaultList && (
          <p className="text-meta text-warning">“{link.department.name}” isn't in the default list. Choose a department from it.</p>
        )}
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
        <select
          id={selectId}
          value={link?.department.id ?? ""}
          disabled={busy}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value), link?.seesAll ?? false)}
          className={SELECT}
        >
          <option value="">{noneLabel}</option>
          {options.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <Switch
          label="Sees all departments"
          ariaLabel={`${name}: sees all departments`}
          on={link?.seesAll ?? false}
          disabled={busy || !link}
          onToggle={() => link && onChange(link.department.id, !link.seesAll)}
        />
      </div>
    </li>
  );
}
