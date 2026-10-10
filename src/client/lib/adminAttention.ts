import { useEffect, useState } from "react";
import type { MappingStatusResponse } from "../../shared/types";
import { getJson } from "../api";

// What needs an Admin's attention (design.md §7, requirements v1.20): only problems an Admin can fix, each fixed in
// Team mapping. Shown on the Admin home, as a count next to "Administrative Settings" in the name menu and a dot on
// the avatar. One shared copy of GET /api/admin/mapping/status, so the header, the sidebar and the Admin home don't
// each ask; it's asked again when a screen asks for a refresh (page load, entering a section) and after any mapping
// change (MAPPING_CHANGED).

/** Dispatched on window by the mapping screen after a change, so everything showing the status follows. */
export const MAPPING_CHANGED = "mapping-changed";

export interface AttentionItem {
  id: string;
  title: string;
  detail: string;
}

/** The status as a list of things to fix; empty when nothing needs attention (or no source is connected at all). */
export function attentionItems(s: MappingStatusResponse | null): AttentionItem[] {
  if (!s?.connected) return [];
  const items: AttentionItem[] = [];
  const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
  if (s.unreachable) {
    items.push({
      id: "unreachable",
      title: `Couldn't reach ${s.unreachable} just now`,
      detail: "Team mapping can't be checked until it's back. Use Refresh in Team mapping to try again.",
    });
  }
  if (!s.ready) {
    items.push({
      id: "not_set_up",
      title: "Team mapping isn't set up",
      detail: "Volunteers can't get in until a Service Type is chosen and a team or position is linked to a department.",
    });
  }
  if (s.unlinked > 0) {
    items.push({
      id: "unlinked",
      title: `${n(s.unlinked, "position", "positions")} on media teams not linked to a department`,
      detail: "People scheduled there won't see their department first.",
    });
  }
  if (s.missing > 0) {
    items.push({
      id: "missing",
      title: `${n(s.missing, "link points", "links point")} to something no longer in the schedule`,
      detail: "Remove or replace the link so it leads somewhere again.",
    });
  }
  if (s.newTeams > 0) {
    items.push({
      id: "new_teams",
      title: `${n(s.newTeams, "new team", "new teams")} to review`,
      detail: "Link it to a department, or mark it “Not a media team”.",
    });
  }
  return items;
}

let latest: MappingStatusResponse | null = null;
let inflight: Promise<void> | null = null;
const listeners = new Set<(s: MappingStatusResponse | null) => void>();

/** Asks the server again (one request at a time); quietly keeps the last answer if it can't. */
export function refreshMappingStatus(): Promise<void> {
  inflight ??= getJson<MappingStatusResponse>("/api/admin/mapping/status")
    .then((s) => {
      latest = s;
      for (const l of listeners) l(s);
    })
    .catch(() => {})
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/**
 * The shared status, for Admins only (`enabled`), refreshed when `refreshKey` changes and after mapping changes.
 * null until the first answer.
 */
export function useMappingStatus(enabled: boolean, refreshKey: unknown = null): MappingStatusResponse | null {
  const [status, setStatus] = useState<MappingStatusResponse | null>(enabled ? latest : null);
  useEffect(() => {
    if (!enabled) return;
    listeners.add(setStatus);
    const onChange = () => void refreshMappingStatus();
    window.addEventListener(MAPPING_CHANGED, onChange);
    return () => {
      listeners.delete(setStatus);
      window.removeEventListener(MAPPING_CHANGED, onChange);
    };
  }, [enabled]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey is the trigger
  useEffect(() => {
    if (enabled) void refreshMappingStatus();
  }, [enabled, refreshKey]);
  return enabled ? status : null;
}

/** Forgets the shared copy (tests). */
export function resetMappingStatus() {
  latest = null;
  inflight = null;
}
