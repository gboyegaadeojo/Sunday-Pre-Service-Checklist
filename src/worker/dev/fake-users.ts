// Test users for local development only. Never included in production builds (see src/worker/index.ts).
// They sign in through the "dev" provider (sources/identity.ts) with their key as the subject, so their
// linked accounts can never collide with a real provider's accounts.

export interface FakeUser {
  key: string;
  name: string;
  description: string;
  onMediaTeam: boolean;
  isAdmin: boolean;
  isDirector: boolean;
}

export const FAKE_USERS: FakeUser[] = [
  {
    key: "volunteer",
    name: "Test Volunteer",
    description: "Volunteer on a media team",
    onMediaTeam: true,
    isAdmin: false,
    isDirector: false,
  },
  {
    key: "admin",
    name: "Test Admin",
    description: "Admin: manages lists, mappings and roles",
    onMediaTeam: true,
    isAdmin: true,
    isDirector: false,
  },
  {
    key: "director",
    name: "Test Director",
    description: "Director: sees progress, can reset",
    onMediaTeam: false,
    isAdmin: false,
    isDirector: true,
  },
  {
    key: "outsider",
    name: "Test Non-member",
    description: "Signed in, but not on a media team",
    onMediaTeam: false,
    isAdmin: false,
    isDirector: false,
  },
];
