// Schedule sources (requirements C22): service types, teams and positions, team membership, plans and who
// is scheduled. Planning Center is one implementation (Stage 9); a fake one is used for development and
// tests (Stage 7). Nothing else in the app knows which source is in use. Outside IDs are stored with the
// source's name (team_links.source, services.plan_source), never in Planning Center–named columns.
//
// The source in use is c.var.schedule (src/worker/index.ts): the fake one in local development and tests,
// Planning Center from Stage 9, and null in production until then.

import type { IdentityProviderId } from "./identity";

/** Source names as stored in team_links.source and services.plan_source. */
export type ScheduleSourceId = "planning_center" | "fake";

export interface SourceServiceType {
  externalId: string;
  name: string;
}

export interface SourceTeam {
  externalId: string;
  name: string;
  positions: { externalId: string; name: string }[];
}

export interface SourcePlan {
  externalId: string;
  /** "YYYY-MM-DD" in the church's time zone. */
  date: string;
}

/** One team, or one position within a team, a person is scheduled for in a plan. */
export interface SourceAssignment {
  teamExternalId: string;
  positionExternalId: string | null;
}

/**
 * Read-only access to the church's schedule. `person` is the source's own ID for the person, found through
 * the user's linked sign-in account for that source (user_identities). Every call may throw
 * ProviderUnavailableError (sources/identity.ts); callers fall back as US-04a describes.
 */
export interface ScheduleSource {
  readonly id: ScheduleSourceId;
  /** How it's named on screen, e.g. in "Refresh from Planning Center". */
  readonly label: string;
  listServiceTypes(): Promise<SourceServiceType[]>;
  listTeams(serviceTypeExternalId: string): Promise<SourceTeam[]>;
  /** Teams the person is a member of (roster, not just this week's schedule: US-02). */
  teamsOf(person: string): Promise<string[]>;
  /** The earliest plan on or after `fromDate` (US-07), or null if none is published. */
  nextPlan(serviceTypeExternalId: string, fromDate: string): Promise<SourcePlan | null>;
  assignments(planExternalId: string, person: string): Promise<SourceAssignment[]>;
}

/**
 * Which sign-in account holds a person's ID in each schedule source: a person's Planning Center sign-in subject is
 * their Planning Center person ID, and the fake source uses the test users' "dev" sign-in subjects (their keys).
 */
export const PERSON_PROVIDER: Record<ScheduleSourceId, IdentityProviderId> = {
  planning_center: "planning_center",
  fake: "dev",
};
