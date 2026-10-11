// A read-only client for Planning Center's API (JSON:API), used with the church's Personal Access Token (Stage 9b,
// US-17). It only ever sends GET requests: the app reads the schedule and never changes anything in Planning Center.
// Every failure that means "Planning Center can't answer right now" becomes ProviderUnavailableError, so callers fall
// back as US-04a describes (sources/cache.ts adds the 5-second limit and remembers an outage for a minute).

import { ProviderUnavailableError } from "../identity";

export const API_BASE = "https://api.planningcenteronline.com";

/** One JSON:API resource, as Planning Center returns it. */
export interface Resource {
  type: string;
  id: string;
  attributes: Record<string, unknown>;
  relationships?: Record<string, { data: { type: string; id: string } | { type: string; id: string }[] | null }>;
}

interface Page {
  data: Resource | Resource[];
  included?: Resource[];
  links?: { next?: string | null };
}

/** At most this many pages per list (100 items each): far more than a church's teams or upcoming plans. */
const MAX_PAGES = 20;

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/** Planning Center has no such thing (404), e.g. someone with no Services profile: an answer, not an outage. */
export class NotFoundError extends Error {}

export interface PlanningCenterClient {
  /** Every item of a list (following "next" pages, up to `maxPages`), plus everything `include` brought along. */
  list(path: string, maxPages?: number): Promise<{ data: Resource[]; included: Resource[] }>;
}

export function createClient(
  credentials: { appId: string; secret: string },
  fetchImpl: FetchLike = (url, init) => fetch(url, init),
): PlanningCenterClient {
  const authorization = `Basic ${btoa(`${credentials.appId}:${credentials.secret}`)}`;

  async function get(url: string): Promise<Page> {
    let res: Response;
    try {
      res = await fetchImpl(url, { method: "GET", headers: { Authorization: authorization, Accept: "application/json" } });
    } catch (err) {
      throw new ProviderUnavailableError(`Planning Center couldn't be reached: ${(err as Error).message}`);
    }
    if (res.status === 401 || res.status === 403) {
      // The token is wrong, revoked, or can't see Services: an Admin needs to fix the Worker's settings.
      console.error(`Planning Center refused the schedule token (${res.status}). Check PCO_PAT_ID and PCO_PAT_SECRET.`);
      throw new ProviderUnavailableError(`Planning Center refused the token (${res.status})`);
    }
    if (res.status === 404) throw new NotFoundError(`Planning Center has nothing at ${new URL(url).pathname}`);
    if (res.status === 429 || res.status >= 500) throw new ProviderUnavailableError(`Planning Center answered ${res.status}`);
    if (!res.ok) throw new ProviderUnavailableError(`Planning Center answered ${res.status} for ${new URL(url).pathname}`);
    return (await res.json()) as Page;
  }

  return {
    async list(path, maxPages = MAX_PAGES) {
      const data: Resource[] = [];
      const included: Resource[] = [];
      let url: string | null = new URL(path, API_BASE).toString();
      for (let page = 0; url && page < maxPages; page++) {
        const body: Page = await get(url);
        data.push(...(Array.isArray(body.data) ? body.data : [body.data]));
        included.push(...(body.included ?? []));
        // Only follow links back to Planning Center's API, so a token is never sent anywhere else.
        const next: string | null = body.links?.next ?? null;
        url = next?.startsWith(`${API_BASE}/`) ? next : null;
      }
      return { data, included };
    },
  };
}

/** The ID of a to-one relationship, or null. */
export const relatedId = (r: Resource, name: string): string | null => {
  const rel = r.relationships?.[name]?.data;
  return rel && !Array.isArray(rel) ? rel.id : null;
};
