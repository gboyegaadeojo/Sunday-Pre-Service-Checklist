import { useCallback, useEffect, useRef, useState } from "react";
import type { ActivityResponse, HistoryResponse, ServiceHistoryResponse, ServiceSummary } from "../../../shared/types";
import { getJson, isAuthError } from "../../api";
import { RouteLink } from "../../components/app/RouteLink";
import { Card } from "../../components/ui/Card";
import { CheckIcon } from "../../components/ui/Icons";
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

// Service history (Stage 5d.3, design.md §7, US-07): past services, each read-only with what was checked (as
// recorded at check-off time, so later edits and hides don't change it), its resets and its activity log.
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
  [`${plural(s.checkedCount, "task")} checked`,s.resetCount > 0 ? `reset ${s.resetCount === 1 ? "once" : `${s.resetCount} times`}` : ""]
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

  const [{ service, categories, resets }, log] = state.data;
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
        {service.isCurrent && (
          <p className="text-meta text-warning">This is the current service, so this record can still change.</p>
        )}
      </header>

      <section aria-labelledby="checked-heading" className="space-y-3">
        <div>
          <h2 id="checked-heading" className="font-semibold">
            Checked tasks
          </h2>
          <p className="text-meta text-fg-muted">
            Tasks still checked at the end, under the department and section they were in when checked. The app doesn't keep
            a copy of the whole checklist for past services, so unchecked tasks aren't listed.
          </p>
        </div>
        {categories.length === 0 ? (
          <EmptyState title="Nothing was checked off." />
        ) : (
          categories.map((c) => (
            <Card key={c.id} className="overflow-hidden">
              <h3 className="border-b border-line px-4 py-3 font-semibold wrap-anywhere">{c.name}</h3>
              {c.sections.map((s) => (
                <div key={s.id} className="border-b border-line last:border-b-0">
                  <h4 className="px-4 pt-3 pb-1 text-meta font-semibold tracking-wide text-fg-muted uppercase wrap-anywhere">{s.name}</h4>
                  <ul className="pb-2">
                    {s.tasks.map((t) => (
                      <li key={t.taskId} className="flex gap-3 px-4 py-1.5">
                        <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" />
                        <span className="min-w-0">
                          <span className="block text-task wrap-anywhere">{t.text}</span>
                          <span className="block text-meta text-fg-muted">
                            {t.by} · {formatTime(t.at, timeZone)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </Card>
          ))
        )}
      </section>

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
