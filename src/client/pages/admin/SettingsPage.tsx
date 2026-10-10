import { type FormEvent, type ReactNode, useCallback, useId, useMemo, useState } from "react";
import { currentServiceDate, isTimeZone } from "../../../shared/service-day";
import { BRANDING_MAX, type ChurchSettings, SHORT_NAME_MAX, type SettingsResponse, type UpdateSettingsRequest } from "../../../shared/types";
import { Brand } from "../../components/app/Brand";
import { SaveIndicator } from "../../components/checklist/SaveIndicator";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { ErrorFeedback, NoticeFeedback } from "../../components/ui/Feedback";
import { ErrorState, LoadingState } from "../../components/ui/States";
import { BrandingContext, documentTitle } from "../../lib/branding";
import { plural } from "../../lib/checklist";
import { formatServiceDate } from "../../lib/format";
import { useSettings } from "../../lib/useAdminList";

const FIELD =
  "w-full rounded-control border border-line bg-bg px-3 py-2.5 text-base text-fg placeholder:text-fg-muted focus-visible:border-accent-soft";
const SELECT = "min-h-11 w-full rounded-control border border-line bg-bg px-3 text-base text-fg focus-visible:border-accent-soft";

/** Weekday names in the viewer's language: 0 = Sunday … 6 = Saturday (4 Jan 1970 was a Sunday). */
const WEEKDAYS = Array.from({ length: 7 }, (_, i) =>
  new Intl.DateTimeFormat(undefined, { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(1970, 0, 4 + i))),
);

/** Every time zone this browser knows, grouped by region ("America", "Europe", …). */
function timeZoneGroups(current: string): [string, string[]][] {
  const zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  const all = current && !zones.includes(current) ? [current, ...zones] : zones;
  const groups = new Map<string, string[]>();
  for (const zone of all) {
    const region = zone.includes("/") ? zone.split("/")[0] : "Other";
    groups.set(region, [...(groups.get(region) ?? []), zone]);
  }
  return [...groups.entries()];
}

/** "Friday 10:24 PM" right now in a time zone, so the admin can check they picked the right one. */
const nowIn = (timeZone: string) =>
  new Intl.DateTimeFormat(undefined, { weekday: "long", hour: "numeric", minute: "2-digit", timeZone }).format(new Date());

type Values = Omit<ChurchSettings, "serviceWeekday"> & { serviceWeekday: number | null };

/** The values as the server will store them (trimmed), for comparing and sending. */
const clean = (v: Values): Values => ({
  timeZone: v.timeZone.trim(),
  serviceWeekday: v.serviceWeekday,
  shortName: v.shortName.trim(),
  teamName: v.teamName.trim(),
  appName: v.appName.trim(),
});

const sameValues = (a: Values, b: Values) => JSON.stringify(clean(a)) === JSON.stringify(clean(b));

/** The current service date under these values, or null while they're incomplete. */
const serviceDateFor = (v: Values) =>
  isTimeZone(v.timeZone) && v.serviceWeekday !== null ? currentServiceDate(new Date(), v.timeZone, v.serviceWeekday).date : null;

function Field({ id, label, hint, children }: { id: string; label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-meta font-medium text-fg-muted">
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-meta text-fg-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

interface Props {
  onAccessChanged: () => void;
  /** Called after branding was saved, so the header and tab title update straight away. */
  onBrandingChanged: () => void;
}

// Church settings, Stage 5d.2 (US-11a; design.md §7): the service calendar (time zone, service weekday) and
// the branding (short name, team name, app name). Admin-only (server enforced); every change is logged.
export function SettingsPage({ onAccessChanged, onBrandingChanged }: Props) {
  const settings = useSettings({ onAccessChanged });
  const [notice, setNotice] = useState<string | null>(null);
  const dismissNotice = useCallback(() => setNotice(null), []);

  const { state } = settings;
  if (state.status === "loading") return <LoadingState label="Loading settings…" />;
  if (state.status === "error") {
    return (
      <main className="mx-auto max-w-app px-4 py-6 md:px-6">
        <ErrorState title="Couldn't load the settings" message={state.message} onRetry={settings.reload} />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 pt-4 pb-24 md:px-6 md:pt-6">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h1 className="text-page font-semibold tracking-tight">Settings</h1>
          <p className="text-meta text-fg-muted">These apply to everyone. Other people see a change the next time they load the app.</p>
        </div>
        <SaveIndicator state={settings.saveState} />
      </header>

      {/* Keyed by the saved values, so the form starts over from what the server has after each save. */}
      <SettingsForm
        key={JSON.stringify(state.data.settings)}
        data={state.data}
        error={settings.error}
        dismissError={settings.dismissError}
        onSave={async (body, before) => {
          const saved = await settings.save(body);
          if (!saved) return false;
          if (saved.changed.some((f) => f === "shortName" || f === "teamName" || f === "appName")) onBrandingChanged();
          const moved = saved.currentServiceDate !== before;
          setNotice(
            saved.changed.length === 0
              ? "Nothing to save: those are the current settings."
              : `Settings saved.${moved ? ` The current service is now ${formatServiceDate(saved.currentServiceDate)}.` : ""}`,
          );
          return true;
        }}
      />

      <NoticeFeedback message={notice} onDismiss={dismissNotice} />
    </main>
  );
}

function SettingsForm({
  data,
  error,
  dismissError,
  onSave,
}: {
  data: SettingsResponse;
  error: string | null;
  dismissError: () => void;
  onSave: (body: UpdateSettingsRequest, currentServiceDate: string | null) => Promise<boolean>;
}) {
  const saved: Values = data.settings;
  const [values, setValues] = useState<Values>(saved);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const id = useId();
  const set = (patch: Partial<Values>) => setValues((v) => ({ ...v, ...patch }));
  const zones = useMemo(() => timeZoneGroups(saved.timeZone), [saved.timeZone]);

  const changed = !sameValues(values, saved);
  const complete = isTimeZone(values.timeZone) && values.serviceWeekday !== null;
  const oldDate = data.currentService?.date ?? null;
  const newDate = serviceDateFor(values);
  const moves = newDate !== null && newDate !== oldDate;
  const preview = clean(values);

  const save = async () => {
    if (!complete || values.serviceWeekday === null) return;
    setBusy(true);
    const ok = await onSave({ ...clean(values), serviceWeekday: values.serviceWeekday }, oldDate);
    setBusy(false);
    if (ok) setConfirming(false);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!changed || !complete || busy) return;
    // Moving the current service is consequential (design.md §7): confirm it first.
    if (moves && oldDate !== null) setConfirming(true);
    else void save();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Card className="space-y-4 p-4">
        <div>
          <h2 className="font-semibold">Service calendar</h2>
          <p className="text-meta text-fg-muted">Decides which date is the current service, and the times shown across the app.</p>
        </div>
        <Field
          id={`${id}-tz`}
          label="Time zone"
          hint={isTimeZone(values.timeZone) ? `It's ${nowIn(values.timeZone)} there now.` : "Choose the church's time zone."}
        >
          <select
            id={`${id}-tz`}
            aria-describedby={`${id}-tz-hint`}
            value={values.timeZone}
            onChange={(e) => set({ timeZone: e.target.value })}
            className={SELECT}
          >
            {!isTimeZone(values.timeZone) && <option value="">Choose a time zone</option>}
            {zones.map(([region, list]) => (
              <optgroup key={region} label={region}>
                {list.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone.replaceAll("_", " ")}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field
          id={`${id}-day`}
          label="Service day"
          hint={
            oldDate === null && newDate === null
              ? null
              : moves
                ? `The current service will move from ${oldDate ? formatServiceDate(oldDate) : "—"} to ${formatServiceDate(newDate)}.`
                : `Current service: ${formatServiceDate((newDate ?? oldDate) as string)}.`
          }
        >
          <select
            id={`${id}-day`}
            aria-describedby={`${id}-day-hint`}
            value={values.serviceWeekday ?? ""}
            onChange={(e) => set({ serviceWeekday: Number(e.target.value) })}
            className={SELECT}
          >
            {values.serviceWeekday === null && <option value="">Choose a day</option>}
            {WEEKDAYS.map((name, i) => (
              <option key={name} value={i}>
                {name}
              </option>
            ))}
          </select>
        </Field>
      </Card>

      <Card className="space-y-4 p-4">
        <div>
          <h2 className="font-semibold">Branding</h2>
          <p className="text-meta text-fg-muted">Shown in the header, on the sign-in screen and in the browser tab. Leave a field empty to leave it out.</p>
        </div>
        <div className="space-y-2 rounded-control border border-line bg-bg p-3">
          <p className="text-meta font-semibold tracking-wide text-fg-muted uppercase">Preview</p>
          <BrandingContext.Provider
            value={{ shortName: preview.shortName || null, teamName: preview.teamName || null, appName: preview.appName || null }}
          >
            <Brand />
          </BrandingContext.Provider>
          <p className="text-meta text-fg-muted wrap-anywhere">
            Tab title:{" "}
            <span className="text-fg">
              {documentTitle({ shortName: null, teamName: preview.teamName || null, appName: preview.appName || null })}
            </span>
          </p>
        </div>
        <Field id={`${id}-short`} label="Short name (logo mark)" hint={`Up to ${SHORT_NAME_MAX} characters, e.g. the church's initials.`}>
          <input
            id={`${id}-short`}
            aria-describedby={`${id}-short-hint`}
            value={values.shortName}
            maxLength={SHORT_NAME_MAX}
            onChange={(e) => set({ shortName: e.target.value })}
            className={FIELD}
          />
        </Field>
        <Field id={`${id}-team`} label="Team name">
          <input
            id={`${id}-team`}
            value={values.teamName}
            maxLength={BRANDING_MAX}
            onChange={(e) => set({ teamName: e.target.value })}
            className={FIELD}
          />
        </Field>
        <Field id={`${id}-app`} label="App name">
          <input
            id={`${id}-app`}
            value={values.appName}
            maxLength={BRANDING_MAX}
            onChange={(e) => set({ appName: e.target.value })}
            className={FIELD}
          />
        </Field>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" disabled={!changed || !complete || busy}>
          {busy && !confirming ? "Saving…" : "Save changes"}
        </Button>
        <Button onClick={() => setValues(saved)} disabled={!changed || busy}>
          Discard changes
        </Button>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Move the current service?"
        confirmLabel="Save changes"
        busy={busy}
        error={confirming ? error : null}
        onConfirm={() => void save()}
        onCancel={() => {
          dismissError();
          setConfirming(false);
        }}
      >
        {oldDate && newDate && (
          <>
            <p>
              The current service is {formatServiceDate(oldDate)}. With these settings it becomes{" "}
              <span className="font-medium text-fg">{formatServiceDate(newDate)}</span>, for everyone.
            </p>
            {data.currentService?.checkedCount ? (
              <p>
                {formatServiceDate(oldDate)} has {plural(data.currentService.checkedCount, "task")} checked. They stay with that date
                and won't show on the new current service, which starts with nothing checked.
              </p>
            ) : (
              <p>{formatServiceDate(oldDate)} has nothing checked, so nothing is left behind.</p>
            )}
          </>
        )}
      </ConfirmDialog>

      <ErrorFeedback message={confirming ? null : error} onDismiss={dismissError} />
    </form>
  );
}
