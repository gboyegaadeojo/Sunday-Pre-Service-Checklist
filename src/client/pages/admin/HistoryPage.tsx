import { useCallback, useEffect, useRef, useState } from "react";
import type { ActivityResponse, HistoryCategory, HistoryResponse, HistoryTask, ServiceHistoryResponse, ServiceSummary } from "../../../shared/types";
import { getJson, isAuthError } from "../../api";
import { RouteLink } from "../../components/app/RouteLink";
import { Card } from "../../components/ui/Card";
import { CheckIcon } from "../../components/ui/Icons";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/States";
import { ACTION, OUTCOME, describeCheckoff, formatWhen, short } from "../../lib/activity";
import { formatDateTime, formatServiceDate, formatTime } from "../../lib/format";
import type { Navigate } from "../../lib/router";

interface Props {
  /** The route's query string: "?service=ID" opens one service, anything else lists them. */
  search: string;
  onAccessChanged: () => void;
  onNavigate: Navigate;
}

type Load<T> = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: T };

/** Loads once on arrival (read-only screen); auth errors hand over to App. */
function useLoad<T>(load: () => Promise<T>, onAccessChanged: () => void) {
  const [state, setState] = useState<Load<T>>({ status: "loading" });
  const ref = useRef({ load, onAccessChanged });
  ref.current = { load, onAccessChanged };
  const run = useCallback(async () => {
    setState({ status: "loading" });
    try {
      setState({ status: "ready", data: await ref.current.load() });
    } catch (err) {
      if (isAuthError(err)) return ref.current.onAccessChanged();
      setState({ status: "error", message: (err as Error).message });
    }
  }, []);
  useEffect(() => {
    void run();
  }, [run]);
  return { state, reload: run };
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// Service history (Stage 5d.3, design.md §7, US-07): past services, each read-only with its checklist, its resets and
// its activity log. Services with a record of their checklist (US-07b) show "X of Y done" and what wasn't checked;
// older ones show only what was checked, as recorded at check-off time. Later edits and hides change neither.
export function HistoryPage({ search, onAccessChanged, onNavigate }: Props) {
  const param = new URLSearchParams(search).get("service");
  return param && /^\d+$/.test(param) ? (
    <ServiceRecord serviceId={Number(param)} onAccessChanged={onAccessChanged} onNavigate={onNavigate} />
  ) : (
    <ServiceList onAccessChanged={onAccessChanged} onNavigate={onNavigate} />
  );
}

function ServiceList({ onAccessChanged, onNavigate }: Omit<Props, "search">) {
  const { state, reload } = useLoad(() => getJson<HistoryResponse>("/api/admin/history"), onAccessChanged);
  if (state.status === "loading") return <LoadingState label="Loading service history…" />;
  if (state.status === "error") {
    return (
      <main className="mx-auto max-w-app px-4 py-6 md:px-6">
        <ErrorState title="Couldn't load the service history" message={state.message} onRetry={() => void reload()} />
      </main>
    );
  }
  const { services, truncated } = state.data;

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 pt-4 pb-16 md:px-6 md:pt-6">
      <header>
        <h1 className="text-page font-semibold tracking-tight">Service history</h1>
        <p className="text-meta text-fg-muted">
          Past services, newest first. Each shows what was checked as it was at the time, even if the checklist has changed since.
          Nothing here can be edited.
        </p>
      </header>
      {services.length === 0 ? (
        <EmptyState title="No past services yet." message="A service appears here once its date has passed." />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {services.map((s) => (
              <li key={s.id}>
                <RouteLink
                  to="admin-history"
                  search={`?service=${s.id}`}
                  current={false}
                  onNavigate={onNavigate}
                  className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-hover"
                >
                  <span className="min-w-0">
                    <span className="block font-medium">{formatServiceDate(s.date)}</span>
                    <span className="block text-meta text-fg-muted wrap-anywhere">
                      <ListName list={s.list} />
                    </span>
                  </span>
                  <span className="text-meta text-fg-muted">{summaryCounts(s)}</span>
                </RouteLink>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {truncated && <p className="text-meta text-fg-muted">Showing the latest 200 services.</p>}
    </main>
  );
}

const summaryCounts = (s: ServiceSummary) =>
  [
    // Services from before the checklist record (US-07b) only know what was checked, so say why there's no "of Y".
    s.totalCount === null ? `${plural(s.checkedCount, "task")} checked (full list not recorded)` : `${s.checkedCount} of ${s.totalCount} done`,
    s.resetCount > 0 ? `reset ${s.resetCount === 1 ? "once" : `${s.resetCount} times`}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

function ListName({ list }: { list: ServiceSummary["list"] }) {
  return (
    <>
      {list.name}
      {list.hidden && <span className="ml-2 inline-block rounded-control border border-line px-1.5 text-meta">hidden list</span>}
    </>
  );
}

function ServiceRecord({ serviceId, onAccessChanged, onNavigate }: Omit<Props, "search"> & { serviceId: number }) {
  const { state, reload } = useLoad(
    () =>
      Promise.all([
        getJson<ServiceHistoryResponse>(`/api/admin/history/${serviceId}`),
        getJson<ActivityResponse>(`/api/services/${serviceId}/events`),
      ]),
    onAccessChanged,
  );

  const back = (
    <RouteLink
      to="admin-history"
      current={false}
      onNavigate={onNavigate}
      className="-ml-2 inline-flex min-h-11 items-center rounded-control px-2 text-sm text-fg-muted transition-colors hover:bg-hover hover:text-fg"
    >
      ← All services
    </RouteLink>
  );

  if (state.status === "loading") return <LoadingState label="Loading service…" />;
  if (state.status === "error") {
    return (
      <main className="mx-auto max-w-app space-y-4 px-4 py-6 md:px-6">
        {back}
        <ErrorState title="Couldn't load this service" message={state.message} onRetry={() => void reload()} />
      </main>
    );
  }

  const [{ service, categories, removed, resets }, log] = state.data;
  const { timeZone } = service;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 pt-2 pb-16 md:px-6 md:pt-4">
      <header className="space-y-1">
        {back}
        <h1 className="text-page font-semibold tracking-tight">{formatServiceDate(service.date)}</h1>
        <p className="text-meta text-fg-muted wrap-anywhere">
          <ListName list={service.list} /> · {summaryCounts(service)}
        </p>
        {service.totalCount !== null && (
          <ProgressBar progress={{ done: service.checkedCount, total: service.totalCount }} label="Overall progress" className="max-w-sm" />
        )}
        {service.isCurrent && (
          <p className="text-meta text-warning">This is the current service, so this record can still change.</p>
        )}
      </header>

      {service.record ? (
        <section aria-labelledby="checklist-heading" className="space-y-3">
          <div>
            <h2 id="checklist-heading" className="font-semibold">
              Checklist
            </h2>
            <p className="text-meta text-fg-muted">Every task on the checklist when the service ended, where it was then.</p>
            {service.record.partial && (
              <p className="mt-1 text-meta text-warning">
                The record started at {formatDateTime(service.record.from, timeZone)}, partway through this service, so tasks
                hidden before then aren't counted.
              </p>
            )}
          </div>
          {categories.length === 0 ? (
            <EmptyState title="The checklist was empty." />
          ) : (
            categories.map((c) => <DepartmentRecord key={c.id} category={c} timeZone={timeZone} withTotals />)
          )}
        </section>
      ) : (
        <section aria-labelledby="checked-heading" className="space-y-3">
          <div>
            <h2 id="checked-heading" className="font-semibold">
              Checked tasks
            </h2>
            <p className="text-meta text-fg-muted">
              Tasks still checked at the end, under the department and section they were in when checked. This service is
              from before the app kept a record of each service's checklist, so unchecked tasks and totals aren't available.
            </p>
          </div>
          {categories.length === 0 ? (
            <EmptyState title="Nothing was checked off." />
          ) : (
            categories.map((c) => <DepartmentRecord key={c.id} category={c} timeZone={timeZone} withTotals={false} />)
          )}
        </section>
      )}

      {removed.length > 0 && (
        <section aria-labelledby="removed-heading" className="space-y-3">
          <div>
            <h2 id="removed-heading" className="font-semibold">
              Removed during the service
            </h2>
            <p className="text-meta text-fg-muted">Hidden from the checklist before the service ended, so not counted above.</p>
          </div>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-line">
              {removed.map((t) => (
                <li key={t.taskId} className="flex gap-3 px-4 py-2.5">
                  <TaskMark checked={t.checkoff !== null} />
                  <span className="min-w-0">
                    <span className="block text-task wrap-anywhere">{t.text}</span>
                    <span className="block text-meta text-fg-muted wrap-anywhere">
                      {t.department} › {t.section}
                      {t.removedAt && <> · removed {formatDateTime(t.removedAt, timeZone)}</>}
                    </span>
                    <CheckoffLine task={t} timeZone={timeZone} />
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      {resets.length > 0 && (
        <section aria-labelledby="resets-heading" className="space-y-3">
          <h2 id="resets-heading" className="font-semibold">
            Resets
          </h2>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-line">
              {resets.map((r) => (
                <li key={r.id} className="px-4 py-2.5 text-sm">
                  <span className="text-danger">Reset</span> by {r.by}, {formatDateTime(r.at, timeZone)}:{" "}
                  {plural(r.archived, "check-off")} cleared
                  {r.undoneAt && (
                    <span className="block text-meta text-fg-muted">
                      Undone by {r.undoneBy}, {formatDateTime(r.undoneAt, timeZone)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      <section aria-labelledby="log-heading" className="space-y-3">
        <div>
          <h2 id="log-heading" className="font-semibold">
            Activity log
          </h2>
          <p className="text-meta text-fg-muted">Every check-off, uncheck, reset and undo for this service, newest first.</p>
        </div>
        {log.events.length === 0 ? (
          <EmptyState title="No activity for this service." />
        ) : (
          <Card className="overflow-hidden">
            <ol className="divide-y divide-line">
              {log.events.map((e) => (
                <li key={e.id} className="grid gap-x-4 gap-y-0.5 px-4 py-2.5 text-sm md:grid-cols-[8.5rem_minmax(0,1fr)]">
                  <span className="text-meta text-fg-muted tabular-nums md:text-sm">{formatWhen(e.at, timeZone, today)}</span>
                  <span className="min-w-0 wrap-anywhere">
                    <span className={`font-medium ${ACTION[e.action].tone}`}>{ACTION[e.action].label}</span>
                    <span className="text-fg-muted"> · {e.user}</span>
                    <span className="block">
                      {describeCheckoff(e)}
                      {e.outcome !== "applied" && (
                        <span className="ml-2 inline-block rounded-control border border-line px-1.5 text-meta text-fg-muted">
                          {OUTCOME[e.outcome]}
                        </span>
                      )}
                    </span>
                    <span className="block font-mono text-meta text-fg-muted">
                      session {short(e.sessionId)} · tab {short(e.tabId)}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        )}
        {log.truncated && <p className="text-meta text-fg-muted">Showing the latest 500 entries.</p>}
      </section>
    </main>
  );
}

/** One department: its sections and tasks, with "X of Y done" when every task is listed (a record). */
function DepartmentRecord({ category, timeZone, withTotals }: { category: HistoryCategory; timeZone: string; withTotals: boolean }) {
  const tasks = category.sections.flatMap((s) => s.tasks);
  const done = tasks.filter((t) => t.checkoff).length;
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-line px-4 py-3">
        <h3 className="font-semibold wrap-anywhere">{category.name}</h3>
        {withTotals && (
          <span className="text-meta text-fg-muted">
            {done} of {tasks.length} done
          </span>
        )}
      </div>
      {category.sections.map((s) => (
        <div key={s.id} className="border-b border-line last:border-b-0">
          <h4 className="px-4 pt-3 pb-1 text-meta font-semibold tracking-wide text-fg-muted uppercase wrap-anywhere">{s.name}</h4>
          <ul className="pb-2">
            {s.tasks.map((t) => (
              <li key={t.taskId} className="flex gap-3 px-4 py-1.5">
                <TaskMark checked={t.checkoff !== null} />
                <span className="min-w-0">
                  <span className={`block text-task wrap-anywhere ${t.checkoff ? "" : "text-fg-muted"}`}>{t.text}</span>
                  <CheckoffLine task={t} timeZone={timeZone} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Card>
  );
}

/**
 * A tick for a checked task, an empty circle for one that wasn't (as on Progress: a box would look tappable in this
 * read-only record), with words for screen readers.
 */
function TaskMark({ checked }: { checked: boolean }) {
  return checked ? (
    <span className="mt-0.5 shrink-0 text-success">
      <CheckIcon className="size-4" />
      <span className="sr-only">Checked:</span>
    </span>
  ) : (
    <span className="mt-1 size-3.5 shrink-0 rounded-full border-2 border-idle">
      <span className="sr-only">Not checked:</span>
    </span>
  );
}

/** "Test Volunteer · 9:42 AM", or "Not checked"; plus the text it was checked under, if that changed later. */
function CheckoffLine({ task, timeZone }: { task: HistoryTask; timeZone: string }) {
  const { checkoff } = task;
  if (!checkoff) return <span className="block text-meta text-fg-muted">Not checked</span>;
  return (
    <span className="block text-meta text-fg-muted wrap-anywhere">
      {checkoff.by} · {formatTime(checkoff.at, timeZone)}
      {checkoff.text !== task.text && <> · checked as “{checkoff.text}”</>}
    </span>
  );
}
