// Test users for local development only. Never included in production builds (see src/worker/index.ts).
// IDs are prefixed "dev-" so they can never collide with real Planning Center person IDs.

export interface FakeUser {
  key: string;
  id: string;
  name: string;
  description: string;
  onMediaTeam: boolean;
  isAdmin: boolean;
  isDirector: boolean;
}

export const FAKE_USERS: FakeUser[] = [
  {
    key: "volunteer",
    id: "dev-volunteer",
    name: "Test Volunteer",
    description: "Volunteer on a media team",
    onMediaTeam: true,
    isAdmin: false,
    isDirector: false,
  },
  {
    key: "admin",
    id: "dev-admin",
    name: "Test Admin",
    description: "Admin: manages lists, mappings and roles",
    onMediaTeam: true,
    isAdmin: true,
    isDirector: false,
  },
  {
    key: "director",
    id: "dev-director",
    name: "Test Director",
    description: "Director: sees progress, can reset",
    onMediaTeam: false,
    isAdmin: false,
    isDirector: true,
  },
  {
    key: "outsider",
    id: "dev-outsider",
    name: "Test Non-member",
    description: "Signed in, but not on a media team",
    onMediaTeam: false,
    isAdmin: false,
    isDirector: false,
  },
];
