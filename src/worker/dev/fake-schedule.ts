// A fake schedule source standing in for Planning Center, for local development and tests only (build plan
// Stage 7). Never included in production builds: src/worker/index.ts creates it only inside an
// import.meta.env.DEV branch, so `vite build` drops this file, and test/production-build.test.ts checks that its
// names are absent. Its sample data uses the church's real position names, but nothing is mapped automatically:
// Admins link every team and position in the mapping screen, as they will with real data.
//
// Developers and tests can adjust it (teams added; positions added, renamed or removed; no plan published; down or slow) through /api/dev/schedule, stored
// in the dev_state table so the changes survive dev-server restarts.

import { addDays } from "../../shared/service-day";
import { ProviderUnavailableError } from "../sources/identity";
import type { ScheduleSource, SourceAssignment, SourceServiceType, SourceTeam } from "../sources/schedule";

export const FAKE_SERVICE_TYPES: SourceServiceType[] = [
  { externalId: "st-sunday", name: "Sunday Service" },
  { externalId: "st-special", name: "Special Events" },
];

/** Teams per Service Type. Only the Production team is the media team; the Worship Band shows what isn't. */
const FAKE_TEAMS: Record<string, SourceTeam[]> = {
  "st-sunday": [
    {
      externalId: "team-production",
      name: "Production",
      positions: [
        { externalId: "pos-audio", name: "Audio" },
        { externalId: "pos-camera-1", name: "Camera 1" },
        { externalId: "pos-camera-2", name: "Camera 2" },
        { externalId: "pos-propresenter", name: "Propresenter" },
        { externalId: "pos-production-director", name: "Production Director" },
        { externalId: "pos-miscellaneous", name: "Miscellaneous" },
        { externalId: "pos-technical-director", name: "Technical Director" },
      ],
    },
    {
      externalId: "team-worship-band",
      name: "Worship Band",
      positions: [
        { externalId: "pos-vocals", name: "Vocals" },
        { externalId: "pos-keys", name: "Keys" },
      ],
    },
  ],
  "st-special": [
    {
      externalId: "team-production",
      name: "Production",
      positions: [
        { externalId: "pos-audio", name: "Audio" },
        { externalId: "pos-camera-1", name: "Camera 1" },
      ],
    },
  ],
};

// People are the test users (src/worker/dev/fake-users.ts): the fake source's ID for a person is their test-user key,
// the subject of their "dev" sign-in account.

/** Team rosters (US-02): membership, not this week's schedule. */
const FAKE_ROSTERS: Record<string, string[]> = {
  volunteer: ["team-production"], // on the team, not scheduled this week
  admin: ["team-production"],
  camera2: ["team-production"],
  "audio-presentation": ["team-production"],
  "technical-director": ["team-production"],
  outsider: ["team-worship-band"], // a team that isn't a media team
};

/** Who's scheduled where in every plan (US-05). */
const FAKE_ASSIGNMENTS: Record<string, SourceAssignment[]> = {
  admin: [{ teamExternalId: "team-production", positionExternalId: "pos-production-director" }],
  camera2: [{ teamExternalId: "team-production", positionExternalId: "pos-camera-2" }],
  "audio-presentation": [
    { teamExternalId: "team-production", positionExternalId: "pos-audio" },
    { teamExternalId: "team-production", positionExternalId: "pos-propresenter" },
  ],
  "technical-director": [{ teamExternalId: "team-production", positionExternalId: "pos-technical-director" }],
  outsider: [{ teamExternalId: "team-worship-band", positionExternalId: "pos-vocals" }],
};

/** Developer adjustments to the sample data, kept in dev_state under this key. */
export const FAKE_SCHEDULE_STATE_KEY = "fake_schedule";

export interface FakeScheduleState {
  /** Teams added to a Service Type, as if created in Planning Center. */
  addedTeams?: { serviceTypeExternalId: string; externalId: string; name: string; positions: { externalId: string; name: string }[] }[];
  /** Positions added to a team (in every Service Type that has the team). */
  addedPositions?: { teamExternalId: string; externalId: string; name: string }[];
  /** New names by position ID, as if renamed in Planning Center. */
  renamedPositions?: Record<string, string>;
  /** Position IDs removed, as if deleted in Planning Center. */
  removedPositions?: string[];
  /** No plan is published on service days, as before Planning Center has the service (US-05 note). */
  unpublished?: boolean;
  /** Extra plans on other dates ("YYYY-MM-DD"), e.g. a Saturday special service (US-07). */
  extraPlans?: { date: string }[];
  /** Planning Center is down: every call fails, and sign-in through it is unavailable (US-04a, US-04b). */
  down?: boolean;
  /** Every call takes this long to answer, to try the 5-second limit (US-04a). */
  delayMs?: number;
}

export async function readFakeScheduleState(db: D1Database): Promise<FakeScheduleState> {
  const row = await db.prepare("SELECT json FROM dev_state WHERE key = ?").bind(FAKE_SCHEDULE_STATE_KEY).first<{ json: string }>();
  return row ? (JSON.parse(row.json) as FakeScheduleState) : {};
}

export const writeFakeScheduleState = (db: D1Database, state: FakeScheduleState) =>
  db
    .prepare("INSERT INTO dev_state (key, json) VALUES (?1, ?2) ON CONFLICT (key) DO UPDATE SET json = excluded.json")
    .bind(FAKE_SCHEDULE_STATE_KEY, JSON.stringify(state))
    .run();

/** The first date on or after `fromDate` that falls on the church's service day (the service_weekday setting). */
async function nextServiceDay(db: D1Database, fromDate: string): Promise<string> {
  const row = await db.prepare("SELECT value FROM settings WHERE key = 'service_weekday'").first<{ value: string }>();
  const weekday = Number(row?.value);
  const from = new Date(`${fromDate}T00:00:00Z`).getUTCDay();
  return addDays(fromDate, (weekday - from + 7) % 7);
}

/** The adjustments, after any delay; throws as an unreachable source would while "down". */
async function answer(db: D1Database): Promise<FakeScheduleState> {
  const state = await readFakeScheduleState(db);
  if (state.delayMs) await new Promise((resolve) => setTimeout(resolve, state.delayMs));
  if (state.down) throw new ProviderUnavailableError("The fake schedule source is switched to down");
  return state;
}

/** The fake source. A factory with no module-level side effects, so production builds drop it entirely. */
export function createFakeScheduleSource(db: D1Database): ScheduleSource {
  return {
    id: "fake",
    label: "Planning Center (sample data)",
    listServiceTypes: async () => {
      await answer(db);
      return FAKE_SERVICE_TYPES;
    },
    listTeams: async (serviceTypeExternalId) => {
      const state = await answer(db);
      const removed = new Set(state.removedPositions ?? []);
      const added = (state.addedTeams ?? [])
        .filter((t) => t.serviceTypeExternalId === serviceTypeExternalId)
        .map(({ externalId, name, positions }) => ({ externalId, name, positions }));
      return [...(FAKE_TEAMS[serviceTypeExternalId] ?? []), ...added].map((team) => ({
        ...team,
        positions: [...team.positions, ...(state.addedPositions ?? []).filter((p) => p.teamExternalId === team.externalId)]
          .filter((p) => !removed.has(p.externalId))
          .map((p) => ({ externalId: p.externalId, name: state.renamedPositions?.[p.externalId] ?? p.name })),
      }));
    },
    teamsOf: async (person) => {
      await answer(db);
      return FAKE_ROSTERS[person] ?? [];
    },
    // Plans are published on every service day (the church's setting), unless a developer marked them unpublished,
    // plus any extra plans a developer added on other dates. The earliest on or after fromDate comes back (US-07).
    nextPlan: async (serviceTypeExternalId, fromDate) => {
      const state = await answer(db);
      if (!FAKE_TEAMS[serviceTypeExternalId]) return null;
      const dates = [...(state.unpublished ? [] : [await nextServiceDay(db, fromDate)]), ...(state.extraPlans ?? []).map((p) => p.date)]
        .filter((d) => d >= fromDate)
        .sort();
      return dates[0] ? { externalId: `plan-${serviceTypeExternalId}-${dates[0]}`, date: dates[0] } : null;
    },
    assignments: async (_plan, person) => {
      await answer(db);
      return FAKE_ASSIGNMENTS[person] ?? [];
    },
  };
}
