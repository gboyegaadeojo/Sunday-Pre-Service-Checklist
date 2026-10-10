// Test users for local development only. Never included in production builds (see src/worker/index.ts).
// They sign in through the "dev" provider (sources/identity.ts) with their key as the subject, so their
// linked accounts can never collide with a real provider's accounts.

export interface FakeUser {
  key: string;
  name: string;
  description: string;
  /** Their starting access before team mapping is set up; afterwards the fake schedule's rosters decide (US-02). */
  onMediaTeam: boolean;
  isAdmin: boolean;
  isDirector: boolean;
}

export const FAKE_USERS: FakeUser[] = [
  {
    key: "volunteer",
    name: "Test Volunteer",
    description: "On the media team, not scheduled this week",
    onMediaTeam: true,
    isAdmin: false,
    isDirector: false,
  },
  {
    key: "admin",
    name: "Test Admin",
    description: "Admin, scheduled as Production Director",
    onMediaTeam: true,
    isAdmin: true,
    isDirector: false,
  },
  {
    key: "director",
    name: "Test Director",
    description: "Director role, not on a team",
    onMediaTeam: false,
    isAdmin: false,
    isDirector: true,
  },
  {
    key: "outsider",
    name: "Test Non-member",
    description: "On the Worship Band only, not a media team",
    onMediaTeam: false,
    isAdmin: false,
    isDirector: false,
  },
  {
    key: "camera2",
    name: "Test Camera Operator",
    description: "Scheduled on Camera 2",
    onMediaTeam: true,
    isAdmin: false,
    isDirector: false,
  },
  {
    key: "audio-presentation",
    name: "Test Two Positions",
    description: "Scheduled on Audio and Propresenter",
    onMediaTeam: true,
    isAdmin: false,
    isDirector: false,
  },
  {
    key: "technical-director",
    name: "Test Technical Director",
    description: "Scheduled as Technical Director",
    onMediaTeam: true,
    isAdmin: false,
    isDirector: false,
  },
];
