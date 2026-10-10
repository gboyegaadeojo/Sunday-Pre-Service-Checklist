// A fake schedule source standing in for Planning Center, for local development and tests only (build plan
// Stage 7). Never included in production builds: src/worker/index.ts creates it only inside an
// import.meta.env.DEV branch, so `vite build` drops this file, and test/production-build.test.ts checks that its
// names are absent. Its sample data uses the church's real position names, but nothing is mapped automatically:
// Admins link every team and position in the mapping screen, as they will with real data.
//
// Developers and tests can adjust it (teams added; positions added, renamed or removed) through /api/dev/schedule, stored
// in the dev_state table so the changes survive dev-server restarts.

import type { ScheduleSource, SourceServiceType, SourceTeam } from "../sources/schedule";

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
}

async function readState(db: D1Database): Promise<FakeScheduleState> {
  const row = await db.prepare("SELECT json FROM dev_state WHERE key = ?").bind(FAKE_SCHEDULE_STATE_KEY).first<{ json: string }>();
  return row ? (JSON.parse(row.json) as FakeScheduleState) : {};
}

export const writeFakeScheduleState = (db: D1Database, state: FakeScheduleState) =>
  db
    .prepare("INSERT INTO dev_state (key, json) VALUES (?1, ?2) ON CONFLICT (key) DO UPDATE SET json = excluded.json")
    .bind(FAKE_SCHEDULE_STATE_KEY, JSON.stringify(state))
    .run();

/** The fake source. A factory with no module-level side effects, so production builds drop it entirely. */
export function createFakeScheduleSource(db: D1Database): ScheduleSource {
  return {
    id: "fake",
    label: "Planning Center (sample data)",
    listServiceTypes: async () => FAKE_SERVICE_TYPES,
    listTeams: async (serviceTypeExternalId) => {
      const state = await readState(db);
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
    // Rosters, plans and assignments arrive with access and the department view (Stage 7b).
    teamsOf: async () => [],
    nextPlan: async () => null,
    assignments: async () => [],
  };
}
