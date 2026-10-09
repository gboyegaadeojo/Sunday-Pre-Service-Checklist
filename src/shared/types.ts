// API request/response shapes shared by the Worker and the browser.

export interface ChecklistTask {
  id: number;
  text: string;
}

export interface ChecklistSection {
  id: number;
  name: string;
  tasks: ChecklistTask[];
}

export interface ChecklistCategory {
  id: number;
  name: string;
  sections: ChecklistSection[];
}

export interface ChecklistResponse {
  list: { id: number; name: string };
  categories: ChecklistCategory[];
}

export interface ApiErrorBody {
  error: string;
  /** Lets the client tell "signed out" (401) from "not on a media team" (403). */
  code?: "signed_out" | "no_access";
}

export interface CurrentUser {
  id: string;
  name: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  isDirector: boolean;
  /** False for a signed-in user who is not on a linked media team and has no role (US-02). */
  hasAccess: boolean;
}

export interface MeResponse {
  user: CurrentUser;
}

// Development-only fake sign-in. Never present in production builds (see src/worker/index.ts).
export interface DevUser {
  key: string;
  name: string;
  description: string;
}

export interface DevUsersResponse {
  users: DevUser[];
}

export interface DevSignInRequest {
  key: string;
}
